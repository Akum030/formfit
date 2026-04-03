/**
 * Sarvam AI Client — Speech-to-Text and Text-to-Speech.
 *
 * Uses Sarvam's REST API for:
 *  - STT: send audio buffer → receive transcript
 *  - TTS: send text → receive audio buffer (bulbul:v3 with natural male voice)
 *
 * Voice improvements:
 *  - Upgraded to bulbul:v3 for more natural/human-like speech
 *  - Male voice "aditya" for gym trainer persona
 *  - Higher sample rate (24000 Hz) for better audio quality
 *  - Temperature 0.7 for expressive coaching
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const STT_ENDPOINT = process.env.SARVAM_STT_ENDPOINT || 'https://api.sarvam.ai/speech-to-text';
const TTS_ENDPOINT = process.env.SARVAM_TTS_ENDPOINT || 'https://api.sarvam.ai/text-to-speech';

// Voice configuration: male "aditya" voice on bulbul:v3 for realistic gym trainer
const TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || 'aditya';
const TTS_PACE = 1.1; // Slightly faster for energetic coaching
const TTS_TEMPERATURE = 0.7; // More expressive for natural sound

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

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Convert speech audio buffer to text using Sarvam STT.
 */
export async function speechToText(
  audioBuffer: Buffer,
  language: string = 'hi-IN'
): Promise<STTResult> {
  if (!SARVAM_API_KEY) {
    console.warn('[SarvamClient] No API key — using fallback STT');
    return { transcript: '', confidence: 0 };
  }

  try {
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
 * Convert text to speech using Sarvam TTS with natural male voice.
 * Uses bulbul:v3 for more human-like, expressive speech.
 */
export async function textToSpeech(
  text: string,
  language: string = 'hi-IN',
  speaker?: string
): Promise<TTSResult> {
  if (!SARVAM_API_KEY) {
    console.warn('[SarvamClient] No API key — skipping TTS');
    return { audioBase64: '', durationMs: 0 };
  }

  if (!text.trim()) {
    return { audioBase64: '', durationMs: 0 };
  }

  // Use configured speaker, or allow per-call override
  const effectiveSpeaker = speaker || TTS_SPEAKER;

  try {
    // Build payload — bulbul:v3 uses 'text' (string) not 'inputs' (array)
    const payload: Record<string, unknown> = {
      text: text,
      target_language_code: language,
      speaker: effectiveSpeaker,
      model: TTS_MODEL,
      pace: TTS_PACE,
      speech_sample_rate: 24000,
    };

    // bulbul:v3 supports temperature for expressiveness
    if (TTS_MODEL === 'bulbul:v3') {
      payload.temperature = TTS_TEMPERATURE;
    } else {
      // Legacy bulbul:v2 uses inputs array and enable_preprocessing
      payload.inputs = [text];
      delete payload.text;
      payload.enable_preprocessing = true;
    }

    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[SarvamClient] TTS error:', response.status, errText);
      // Fallback to bulbul:v2 if v3 fails
      if (TTS_MODEL === 'bulbul:v3') {
        console.log('[SarvamClient] Falling back to bulbul:v2...');
        return textToSpeechV2Fallback(text, language);
      }
      return { audioBase64: '', durationMs: 0 };
    }

    const data = await response.json() as { audios?: string[] };
    const audioBase64 = data.audios?.[0] || '';
    // Estimate duration: 24kHz 16bit mono
    const audioBytes = audioBase64.length * 0.75;
    const durationMs = Math.round((audioBytes / (24000 * 2)) * 1000);

    return { audioBase64, durationMs };
  } catch (err) {
    console.error('[SarvamClient] TTS fetch error:', err);
    return { audioBase64: '', durationMs: 0 };
  }
}

/**
 * Fallback to bulbul:v2 if v3 is unavailable.
 */
async function textToSpeechV2Fallback(text: string, language: string): Promise<TTSResult> {
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
        speaker: 'abhilash', // Male voice on v2
        model: 'bulbul:v2',
        enable_preprocessing: true,
        pitch: -0.2, // Slightly deeper for trainer feel
        pace: 1.1,
        loudness: 1.3,
      }),
    });

    if (!response.ok) {
      return { audioBase64: '', durationMs: 0 };
    }

    const data = await response.json() as { audios?: string[] };
    const audioBase64 = data.audios?.[0] || '';
    const audioBytes = audioBase64.length * 0.75;
    const durationMs = Math.round((audioBytes / (16000 * 2)) * 1000);
    return { audioBase64, durationMs };
  } catch {
    return { audioBase64: '', durationMs: 0 };
  }
}
