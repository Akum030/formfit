/**
 * Voice Routes — WebSocket endpoint for continuous duplex voice.
 *
 * Protocol:
 *  - Client connects to /ws/voice?sessionId=xxx
 *  - Client streams audio chunks (binary) for STT
 *  - Server sends back: { type: 'transcript', text }
 *  - Server sends back: { type: 'coaching', text, audioBase64, trigger }
 *  - Client can send: { type: 'interrupt' } to cancel pending audio
 *
 * Handles Sarvam STT/TTS integration.
 */

import WebSocket from 'ws';
import type { IncomingMessage } from 'http';
import { speechToText, textToSpeech } from '../services/sarvamClient';
import { getCoachEngine } from './events';

interface VoiceConnection {
  ws: WebSocket;
  sessionId: string;
  audioBuffer: Buffer[];
  silenceTimer: ReturnType<typeof setTimeout> | null;
  maxTimer: ReturnType<typeof setTimeout> | null;
  isProcessing: boolean;
}

const connections = new Map<string, VoiceConnection>();

/**
 * Handle a new WebSocket voice connection.
 */
export function handleVoiceConnection(ws: WebSocket, request: IncomingMessage) {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(4001, 'Missing sessionId');
    return;
  }

  const conn: VoiceConnection = {
    ws,
    sessionId,
    audioBuffer: [],
    silenceTimer: null,
    maxTimer: null,
    isProcessing: false,
  };

  connections.set(sessionId, conn);

  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      // Audio chunk from microphone
      handleAudioChunk(conn, data as Buffer);
    } else {
      // JSON control message
      try {
        const msg = JSON.parse(data.toString());
        handleControlMessage(conn, msg);
      } catch {
        // Ignore malformed
      }
    }
  });

  ws.on('close', () => {
    if (conn.silenceTimer) clearTimeout(conn.silenceTimer);
    if (conn.maxTimer) clearTimeout(conn.maxTimer);
    connections.delete(sessionId);
  });

  ws.on('error', (err) => {
    console.error('[Voice] WebSocket error:', err);
    if (conn.silenceTimer) clearTimeout(conn.silenceTimer);
    if (conn.maxTimer) clearTimeout(conn.maxTimer);
    connections.delete(sessionId);
  });

  // Send ready message
  sendJSON(ws, { type: 'ready', sessionId });
}

function handleAudioChunk(conn: VoiceConnection, chunk: Buffer) {
  conn.audioBuffer.push(chunk);

  // Reset silence timer — process after 800ms of silence (gives user time to finish speaking)
  if (conn.silenceTimer) clearTimeout(conn.silenceTimer);
  conn.silenceTimer = setTimeout(() => processAudioBuffer(conn), 800);

  // Also set a max timer — force process after 8 seconds regardless of silence
  if (!conn.maxTimer) {
    conn.maxTimer = setTimeout(() => {
      conn.maxTimer = null;
      if (conn.silenceTimer) clearTimeout(conn.silenceTimer);
      conn.silenceTimer = null;
      processAudioBuffer(conn);
    }, 8000);
  }
}

// Minimum ~0.8 seconds of audio at 16kHz 16-bit mono = 25600 bytes
const MIN_AUDIO_BYTES = 25600;
// Maximum ~15 seconds of audio to avoid sending huge buffers to STT
const MAX_AUDIO_BYTES = 16000 * 2 * 15; // 480000 bytes

async function processAudioBuffer(conn: VoiceConnection) {
  if (conn.isProcessing || conn.audioBuffer.length === 0) return;

  // Clear the max timer since we're processing now
  if (conn.maxTimer) { clearTimeout(conn.maxTimer); conn.maxTimer = null; }

  const fullAudio = Buffer.concat(conn.audioBuffer);
  conn.audioBuffer = []; // Always clear to prevent unbounded growth

  // Skip if not enough audio — user probably didn't say anything meaningful
  if (fullAudio.length < MIN_AUDIO_BYTES) {
    console.log(`[Voice] Skipping tiny audio buffer: ${fullAudio.length} bytes (need ${MIN_AUDIO_BYTES})`);
    return;
  }

  // Truncate overly long audio — take only the last MAX_AUDIO_BYTES
  const audioToProcess = fullAudio.length > MAX_AUDIO_BYTES
    ? fullAudio.subarray(fullAudio.length - MAX_AUDIO_BYTES)
    : fullAudio;

  conn.isProcessing = true;

  try {
    console.log(`[Voice] Processing audio buffer: ${fullAudio.length} bytes (~${(fullAudio.length / 32000).toFixed(1)}s)`);

    // STT
    const sttResult = await speechToText(fullAudio);
    console.log(`[Voice] STT result: "${sttResult.transcript}" (confidence: ${sttResult.confidence})`);

    if (sttResult.transcript && sttResult.transcript.trim()) {
      // Send transcript to frontend
      sendJSON(conn.ws, {
        type: 'transcript',
        text: sttResult.transcript,
        confidence: sttResult.confidence,
      });

      // Pass to coach engine for response
      const engine = getCoachEngine(conn.sessionId);
      if (engine) {
        console.log(`[Voice] Generating coaching response for: "${sttResult.transcript}"`);
        const coaching = await engine.handleUserSpeech(sttResult.transcript);
        if (coaching) {
          console.log(`[Voice] Coaching response: "${coaching.text}" (audio: ${coaching.audioBase64 ? 'yes' : 'no'})`);
          sendJSON(conn.ws, {
            type: 'coaching',
            text: coaching.text,
            audioBase64: coaching.audioBase64,
            trigger: coaching.trigger,
          });
        }
      } else {
        console.warn(`[Voice] No coach engine for session: ${conn.sessionId}`);
      }
    }
  } catch (err) {
    console.error('[Voice] audio processing error:', err);
  } finally {
    conn.isProcessing = false;
  }
}

function handleControlMessage(conn: VoiceConnection, msg: { type: string; [key: string]: unknown }) {
  switch (msg.type) {
    case 'interrupt': {
      // Cancel any pending coaching
      const engine = getCoachEngine(conn.sessionId);
      if (engine) engine.cancelPending();
      // Clear pending timers so we can re-process quickly
      if (conn.silenceTimer) { clearTimeout(conn.silenceTimer); conn.silenceTimer = null; }
      if (conn.maxTimer) { clearTimeout(conn.maxTimer); conn.maxTimer = null; }
      conn.isProcessing = false;
      sendJSON(conn.ws, { type: 'interrupted' });
      // If audio was accumulating (user's interrupting speech), process with shorter delay
      if (conn.audioBuffer.length > 0) {
        conn.silenceTimer = setTimeout(() => processAudioBuffer(conn), 500);
      }
      break;
    }

    case 'ping':
      sendJSON(conn.ws, { type: 'pong' });
      break;
  }
}

/**
 * Send coaching audio to a specific voice connection (from events route).
 */
export function sendCoachingToVoice(
  sessionId: string,
  text: string,
  audioBase64: string,
  trigger: string
) {
  const conn = connections.get(sessionId);
  if (conn && conn.ws.readyState === WebSocket.OPEN) {
    sendJSON(conn.ws, { type: 'coaching', text, audioBase64, trigger });
  }
}

function sendJSON(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
