/**
 * useVoiceAgent — Persistent voice connection to backend for
 * continuous duplex voice coaching via Sarvam AI.
 *
 * Features:
 *  - Always-listening microphone (no push-to-talk)
 *  - WebSocket streaming of audio chunks
 *  - TTS playback of coaching responses
 *  - Smart interruptibility: requires sustained loud speech to interrupt coach
 *  - Doesn't send audio to backend when coach is speaking (prevents echo)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceState, VoiceMessage, CoachingMessage } from '../types';

interface UseVoiceAgentOptions {
  sessionId: string | null;
  isActive: boolean;
  language?: string;
  onCoaching?: (msg: CoachingMessage) => void;
  onTranscript?: (text: string) => void;
}

interface UseVoiceAgentResult {
  voiceState: VoiceState;
  lastTranscript: string;
  isMuted: boolean;
  toggleMute: () => void;
  playCoachingAudio: (audioBase64: string) => void;
}

const WS_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('http', 'ws')
  : `ws://${window.location.hostname}:4000`;

// -- Interrupt detection config --
const INTERRUPT_AMP_THRESHOLD = 0.06;   // Much higher — real speech, not noise
const INTERRUPT_FRAMES_NEEDED = 3;       // Need 3 consecutive loud chunks (~750ms)
const POST_SPEAK_COOLDOWN_MS = 600;      // Don't listen for 600ms after coach finishes

export function useVoiceAgent({
  sessionId,
  isActive,
  language = 'hi-IN',
  onCoaching,
  onTranscript,
}: UseVoiceAgentOptions): UseVoiceAgentResult {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const voiceStateRef = useRef<VoiceState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mutedRef = useRef(false);

  // Interrupt debounce state
  const interruptFrameCount = useRef(0);
  const speakEndTime = useRef(0);
  const languageRef = useRef(language);

  // Send language change to backend via WebSocket control message
  useEffect(() => {
    languageRef.current = language;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_language', language }));
    }
  }, [language]);

  // Play coaching audio via Web Audio API
  const playCoachingAudio = useCallback((audioBase64: string) => {
    if (!audioBase64 || mutedRef.current) return;

    try {
      const ctx = audioContextRef.current || new AudioContext();
      audioContextRef.current = ctx;

      // Stop any currently playing audio
      if (playbackSourceRef.current) {
        try { playbackSourceRef.current.stop(); } catch { /* ignore */ }
      }

      // Decode base64 to ArrayBuffer
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      setVoiceState('speaking');
      interruptFrameCount.current = 0; // Reset interrupt counter

      ctx.decodeAudioData(bytes.buffer.slice(0), (buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          speakEndTime.current = Date.now(); // Track when coach stopped
          setVoiceState('listening');
          playbackSourceRef.current = null;
        };
        playbackSourceRef.current = source;
        source.start(0);
      }).catch(() => {
        setVoiceState('listening');
      });
    } catch {
      setVoiceState('listening');
    }
  }, []);

  // Connect WebSocket + start mic
  useEffect(() => {
    if (!sessionId || !isActive) return;

    let ws: WebSocket;
    let cleanedUp = false;

    async function connect() {
      try {
        ws = new WebSocket(`${WS_BASE}/ws/voice?sessionId=${sessionId}&lang=${language}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Voice] WebSocket connected');
          setVoiceState('listening');
        };

        ws.onmessage = (event) => {
          try {
            const msg: VoiceMessage = JSON.parse(event.data);

            switch (msg.type) {
              case 'transcript':
                if (msg.text) {
                  setLastTranscript(msg.text);
                  onTranscript?.(msg.text);
                }
                break;

              case 'coaching':
                if (msg.text) {
                  const coaching: CoachingMessage = {
                    text: msg.text,
                    audioBase64: msg.audioBase64 || '',
                    trigger: (msg.trigger as CoachingMessage['trigger']) || 'form',
                  };
                  onCoaching?.(coaching);

                  if (msg.audioBase64) {
                    playCoachingAudio(msg.audioBase64);
                  }
                }
                break;

              case 'interrupted':
                if (playbackSourceRef.current) {
                  try { playbackSourceRef.current.stop(); } catch { /* ignore */ }
                  playbackSourceRef.current = null;
                }
                setVoiceState('listening');
                break;
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onerror = () => {
          console.warn('[Voice] WebSocket error');
          setVoiceState('error');
        };

        ws.onclose = () => {
          if (!cleanedUp) {
            console.log('[Voice] WebSocket closed');
            setVoiceState('idle');
          }
        };

        // Start microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
          },
        });
        mediaStreamRef.current = stream;

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        console.log(`[Voice] AudioContext sampleRate: ${audioCtx.sampleRate}`);

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        let chunkCount = 0;
        processor.onaudioprocess = (e) => {
          if (mutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

          const input = e.inputBuffer.getChannelData(0);

          // Check for actual audio activity
          let maxAmp = 0;
          for (let i = 0; i < input.length; i++) {
            const abs = Math.abs(input[i]);
            if (abs > maxAmp) maxAmp = abs;
          }

          const currentState = voiceStateRef.current;
          const timeSinceSpeakEnd = Date.now() - speakEndTime.current;

          // ── When coach is speaking: DON'T send audio, only detect interrupts ──
          if (currentState === 'speaking') {
            if (maxAmp > INTERRUPT_AMP_THRESHOLD) {
              interruptFrameCount.current++;
              if (interruptFrameCount.current >= INTERRUPT_FRAMES_NEEDED) {
                // Confirmed deliberate speech — interrupt the coach
                if (playbackSourceRef.current) {
                  try { playbackSourceRef.current.stop(); } catch { /* ignore */ }
                  playbackSourceRef.current = null;
                }
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
                }
                interruptFrameCount.current = 0;
                speakEndTime.current = Date.now();
                setVoiceState('listening');
                console.log('[Voice] Interrupted coach (sustained speech detected)');
              }
            } else {
              interruptFrameCount.current = 0; // Reset if not sustained
            }
            return; // Don't send audio while coach is speaking
          }

          // ── Cooldown after coach finishes — ignore sounds briefly ──
          if (timeSinceSpeakEnd < POST_SPEAK_COOLDOWN_MS) {
            return; // Wait for echo to settle
          }

          // ── Normal listening: send audio if there's signal ──
          if (maxAmp < 0.005) return;

          // Convert Float32 to Int16 PCM
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          chunkCount++;
          if (chunkCount % 20 === 1) {
            console.log(`[Voice] Sending audio chunk #${chunkCount}, maxAmp=${maxAmp.toFixed(4)}`);
          }

          wsRef.current.send(pcm.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

      } catch (err) {
        console.error('[Voice] Setup error:', err);
        setVoiceState('error');
      }
    }

    connect();

    return () => {
      cleanedUp = true;

      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (playbackSourceRef.current) {
        try { playbackSourceRef.current.stop(); } catch { /* ignore */ }
        playbackSourceRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setVoiceState('idle');
    };
  }, [sessionId, isActive, onCoaching, onTranscript, playCoachingAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      mutedRef.current = !m;
      return !m;
    });
  }, []);

  return { voiceState, lastTranscript, isMuted, toggleMute, playCoachingAudio };
}
