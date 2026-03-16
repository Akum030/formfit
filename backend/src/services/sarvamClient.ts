/**
 * Sarvam AI Client — Speech-to-Text and Text-to-Speech.
 *
 * Uses Sarvam's REST API for:
 *  - STT: send audio buffer → receive transcript
 *  - TTS: send text → receive audio buffer
 *
 * voice.ts route manages the WebSocket streaming layer on top of this.
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const STT_ENDPOINT = process.env.SARVAM_STT_ENDPOINT || 'https://api.sarvam.ai/speech-to-text';
const TTS_ENDPOINT = process.env.SARVAM_TTS_ENDPOINT || 'https://api.sarvam.ai/text-to-speech';

export interface STTResult {
  transcript: string;
  confidence: number;
  language?: string;
}

export interface TTSResult {
  audioBase64: string;
  durationMs: number;
}

/**
 * Build a WAV header for raw PCM data.
 * The PCM data is assumed to be 16-bit mono at the given sample rate.
 */
function buildWavBuffer(pcmData: Buffer, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const header = Buffer.alloc(headerSize);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);  // file size - 8
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);             // sub-chunk size
  header.writeUInt16LE(1, 20);              // audio format (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Convert speech audio buffer to text using Sarvam STT.
 * Accepts raw PCM (will add WAV header) or WAV audio.
 */
export async function speechToText(
  audioBuffer: Buffer,
  language: string = 'en-IN'
): Promise<STTResult> {
  if (!SARVAM_API_KEY) {
    console.warn('[SarvamClient] No API key — using fallback STT');
    return { transcript: '', confidence: 0 };
  }

  try {
    // Add WAV header if raw PCM (no RIFF header)
    let wavBuffer = audioBuffer;
    if (audioBuffer.length < 4 || audioBuffer.toString('ascii', 0, 4) !== 'RIFF') {
      wavBuffer = buildWavBuffer(audioBuffer, 16000, 1, 16);
    }

    const formData = new FormData();
    formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
    formData.append('language_code', language);
    formData.append('model', 'saarika:v2.5');

    const response = await fetch(STT_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[SarvamClient] STT error:', response.status, errText);
      return { transcript: '', confidence: 0 };
    }

    const data = await response.json() as { transcript?: string; confidence?: number; language_code?: string };
    return {
      transcript: data.transcript || '',
      confidence: data.confidence || 0,
      language: data.language_code,
    };
  } catch (err) {
    console.error('[SarvamClient] STT fetch error:', err);
    return { transcript: '', confidence: 0 };
  }
}

/**
 * Convert text to speech audio using Sarvam TTS.
 * Returns base64-encoded audio.
 */
export async function textToSpeech(
  text: string,
  language: string = 'en-IN',
  speaker: string = 'anushka'
): Promise<TTSResult> {
  if (!SARVAM_API_KEY) {
    console.warn('[SarvamClient] No API key — skipping TTS');
    return { audioBase64: '', durationMs: 0 };
  }

  if (!text.trim()) {
    return { audioBase64: '', durationMs: 0 };
  }

  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: language,
        speaker,
        model: 'bulbul:v2',
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[SarvamClient] TTS error:', response.status, errText);
      return { audioBase64: '', durationMs: 0 };
    }

    const data = await response.json() as { audios?: string[] };
    const audioBase64 = data.audios?.[0] || '';
    // Estimate duration from base64 length (rough: 16kHz 16bit mono)
    const audioBytes = audioBase64.length * 0.75;
    const durationMs = Math.round((audioBytes / (16000 * 2)) * 1000);

    return { audioBase64, durationMs };
  } catch (err) {
    console.error('[SarvamClient] TTS fetch error:', err);
    return { audioBase64: '', durationMs: 0 };
  }
}
