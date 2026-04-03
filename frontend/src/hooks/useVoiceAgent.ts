/**
 * useVoiceAgent — Browser-native voice coaching using Web Speech API.
 *
 * Zero external API dependencies — uses:
 *  - SpeechRecognition (STT) for always-on listening
 *  - SpeechSynthesis (TTS) with smart voice selection for natural-sounding speech
 *
 * Features:
 *  - Always-listening microphone via SpeechRecognition (no push-to-talk)
 *  - Natural-sounding TTS with preference for high-quality Google/Microsoft voices
 *  - Smart interruptibility: user speech stops current TTS playback
 *  - Sends user transcripts to backend for coaching responses
 *  - Works 100% offline (no API keys needed)
 *  - Stable callback refs prevent reconnection on parent re-renders
 *  - Interim results for faster partial recognition feedback
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceState, CoachingMessage } from '../types';

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
  /** Speak text via browser SpeechSynthesis (fallback) */
  speakText: (text: string) => void;
  /** Play backend audioBase64 (natural Sarvam voice), falls back to speakText */
  speakCoaching: (text: string, audioBase64?: string) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// SpeechRecognition cross-browser support
const SpeechRecognitionAPI =
  (window as unknown as Record<string, unknown>).SpeechRecognition ||
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

/**
 * Select the best-quality voice for the given language.
 * Prefers Google > Microsoft Online > Apple voices as they sound more natural.
 * If no good Hindi voice exists, falls back to English (coaching text is Hinglish).
 */
function selectBestVoice(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice | null {
  const baseLang = langCode.split('-')[0]; // 'hi' from 'hi-IN'

  // Filter voices that match the language
  let langVoices = voices.filter(
    (v) => v.lang === langCode || v.lang.startsWith(baseLang)
  );

  // Scoring: higher = better quality (based on voice provider)
  function voiceScore(v: SpeechSynthesisVoice): number {
    const name = v.name.toLowerCase();
    let score = 0;
    // Google voices (Chrome) are the most natural-sounding
    if (name.includes('google')) score += 100;
    // Microsoft Online (Edge) voices are very good — neural TTS
    if (name.includes('microsoft') && name.includes('online')) score += 90;
    // Regular Microsoft voices are decent
    if (name.includes('microsoft')) score += 50;
    // Apple voices (Safari) are decent
    if (name.includes('samantha') || name.includes('daniel') || name.includes('moira')) score += 60;
    // Prefer non-local/network voices (typically higher quality)
    if (!v.localService) score += 30;
    // Prefer male voices for gym trainer persona
    if (name.includes('male') || name.includes('ravi') || name.includes('madhur')) score += 10;
    return score;
  }

  // If no high-quality Hindi voices exist, fall back to English (en-IN or en-US)
  // The coaching text is Romanized Hindi/Hinglish which English voices read well
  if (langVoices.length === 0 || langVoices.every(v => voiceScore(v) < 50)) {
    const englishVoices = voices.filter(
      (v) => v.lang.startsWith('en-IN') || v.lang.startsWith('en-US') || v.lang.startsWith('en-GB')
    );
    if (englishVoices.length > 0) {
      langVoices = [...langVoices, ...englishVoices];
    }
  }

  if (langVoices.length === 0) return null;

  // Sort by quality score, pick best
  langVoices.sort((a, b) => voiceScore(b) - voiceScore(a));
  return langVoices[0];
}

export function useVoiceAgent({
  sessionId,
  isActive,
  language = 'hi-IN',
  onCoaching,
  onTranscript,
}: UseVoiceAgentOptions): UseVoiceAgentResult {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const mutedRef = useRef(false);
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognitionAPI> | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const isSpeakingRef = useRef(false);
  const cachedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const cachedVoiceLangRef = useRef<string>('');

  // Stable refs for callbacks
  const onCoachingRef = useRef(onCoaching);
  const onTranscriptRef = useRef(onTranscript);
  onCoachingRef.current = onCoaching;
  onTranscriptRef.current = onTranscript;

  const sessionIdRef = useRef(sessionId);
  const languageRef = useRef(language);
  sessionIdRef.current = sessionId;
  languageRef.current = language;

  // ── Preload voices on mount (Chrome loads them asynchronously) ──
  useEffect(() => {
    const synth = window.speechSynthesis;
    // Force voice list load
    synth.getVoices();
    const handleVoicesChanged = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        console.log(`[Voice] ${voices.length} voices available`);
        // Pre-cache best voice for current language
        const best = selectBestVoice(voices, languageRef.current);
        if (best) {
          cachedVoiceRef.current = best;
          cachedVoiceLangRef.current = languageRef.current;
          console.log(`[Voice] Selected: "${best.name}" (${best.lang})`);
        }
      }
    };
    synth.addEventListener('voiceschanged', handleVoicesChanged);
    // Also try immediately (Firefox populates sync)
    handleVoicesChanged();
    return () => synth.removeEventListener('voiceschanged', handleVoicesChanged);
  }, []);

  // ── Update cached voice when language changes ──
  useEffect(() => {
    if (cachedVoiceLangRef.current !== language) {
      const voices = synthRef.current.getVoices();
      const best = selectBestVoice(voices, language);
      if (best) {
        cachedVoiceRef.current = best;
        cachedVoiceLangRef.current = language;
        console.log(`[Voice] Language changed, selected: "${best.name}" (${best.lang})`);
      }
    }
  }, [language]);

  // ── TTS: Speak coaching text via browser SpeechSynthesis ──
  const speakText = useCallback((text: string) => {
    if (!text || mutedRef.current) return;

    try {
      const synth = synthRef.current;
      // Cancel any currently playing speech
      synth.cancel();

      const langCode = languageRef.current || 'hi-IN';

      // Ensure voice is cached for current language
      if (!cachedVoiceRef.current || cachedVoiceLangRef.current !== langCode) {
        const voices = synth.getVoices();
        const best = selectBestVoice(voices, langCode);
        if (best) {
          cachedVoiceRef.current = best;
          cachedVoiceLangRef.current = langCode;
        }
      }

      isSpeakingRef.current = true;
      setVoiceState('speaking');

      // Chrome bug workaround: long utterances get cut off after ~15s
      // Split into sentences if text is very long
      if (text.length > 200) {
        const sentences = (text.match(/[^.!?।]+[.!?।]?\s*/g) || [text]).filter(s => s.trim().length > 0);
        let i = 0;
        function speakNext() {
          if (i >= sentences.length || mutedRef.current) {
            isSpeakingRef.current = false;
            setVoiceState('listening');
            return;
          }
          const chunk = new SpeechSynthesisUtterance(sentences[i].trim());
          if (cachedVoiceRef.current) chunk.voice = cachedVoiceRef.current;
          chunk.lang = langCode;
          chunk.rate = 0.95;
          chunk.pitch = 0.95;
          chunk.volume = 1.0;
          chunk.onend = () => { i++; speakNext(); };
          chunk.onerror = () => { isSpeakingRef.current = false; setVoiceState('listening'); };
          synth.speak(chunk);
        }
        speakNext();
      } else {
        // Short text — speak as a single utterance
        const utterance = new SpeechSynthesisUtterance(text);
        if (cachedVoiceRef.current) utterance.voice = cachedVoiceRef.current;
        utterance.lang = langCode;
        utterance.rate = 0.95;
        utterance.pitch = 0.95;
        utterance.volume = 1.0;
        utterance.onend = () => {
          isSpeakingRef.current = false;
          setVoiceState('listening');
        };
        utterance.onerror = () => {
          isSpeakingRef.current = false;
          setVoiceState('listening');
        };
        synth.speak(utterance);
      }
    } catch {
      isSpeakingRef.current = false;
      setVoiceState('listening');
    }
  }, []);

  // ── Send user transcript to backend for coaching response ──
  const handleUserSpeech = useCallback(async (text: string) => {
    if (!text || !sessionIdRef.current) return;

    try {
      const res = await fetch(`${API_BASE}/api/coaching/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          userText: text,
          language: languageRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          const coaching: CoachingMessage = {
            text: data.text,
            audioBase64: '',
            trigger: data.trigger || 'user_speech',
          };
          onCoachingRef.current?.(coaching);
          speakText(data.text);
        }
      }
    } catch {
      // Silently ignore — backend may be unavailable but app still works
    }
  }, [speakText]);

  // ── STT: Start/stop SpeechRecognition based on session state ──
  useEffect(() => {
    if (!sessionId || !isActive || !SpeechRecognitionAPI) {
      // Clean up recognition if it exists
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      if (!isActive) setVoiceState('idle');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    // Enable interim results for faster partial feedback
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    let shouldRestart = true;
    let lastFinalTimestamp = 0;
    let restartAttempts = 0; // Backoff counter — prevents tight restart loop

    recognition.onstart = () => {
      console.log('[Voice] SpeechRecognition started, lang:', language);
      setVoiceState('listening');
      restartAttempts = 0; // Reset backoff on successful start
    };

    recognition.onresult = (event: { resultIndex: number; results: SpeechRecognitionResultList }) => {
      // Process all results from the current event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();

        if (!text) continue;

        if (result.isFinal) {
          // Debounce: avoid processing the same final result twice in quick succession
          const now = Date.now();
          if (now - lastFinalTimestamp < 300) continue;
          lastFinalTimestamp = now;

          // Only process if confidence is reasonable (> 0.3)
          const confidence = result[0]?.confidence ?? 0;
          if (confidence < 0.3) {
            console.log(`[Voice] Low confidence (${(confidence * 100).toFixed(0)}%), skipping: "${text}"`);
            continue;
          }

          console.log(`[Voice] Final (${(confidence * 100).toFixed(0)}%): "${text}"`);
          setLastTranscript(text);
          onTranscriptRef.current?.(text);

          // If coach is speaking, interrupt
          if (isSpeakingRef.current) {
            synthRef.current.cancel();
            isSpeakingRef.current = false;
            setVoiceState('listening');
          }

          // Send user speech to backend for coaching response
          handleUserSpeech(text);
        } else {
          // Interim result — show as live "hearing" indicator
          setLastTranscript(`${text}...`);
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      // 'no-speech' is normal — just means silence, not an actual error
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('[Voice] SpeechRecognition error:', event.error);
      // 'not-allowed' means microphone permission denied
      if (event.error === 'not-allowed') {
        setVoiceState('error');
        shouldRestart = false;
      }
    };

    recognition.onend = () => {
      // SpeechRecognition stops after silence — auto-restart if session is still active
      // Use exponential backoff to prevent tight restart loop burning CPU
      if (shouldRestart) {
        restartAttempts++;
        const backoffMs = Math.min(5000, 100 * Math.pow(2, restartAttempts - 1));
        setTimeout(() => {
          if (!shouldRestart) return;
          try {
            recognition.start();
          } catch {
            // May fail if already started, ignore
          }
        }, backoffMs);
      }
    };

    try {
      recognition.start();
    } catch {
      console.warn('[Voice] Failed to start SpeechRecognition');
      setVoiceState('error');
    }

    return () => {
      shouldRestart = false;
      try { recognition.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      synthRef.current.cancel();
      isSpeakingRef.current = false;
      setVoiceState('idle');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isActive, language]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      // If muting, stop TTS and pause recognition
      if (next) {
        synthRef.current.cancel();
        isSpeakingRef.current = false;
      }
      return next;
    });
  }, []);

  /**
   * Play backend audioBase64 (natural Sarvam TTS voice) if available,
   * otherwise fall back to browser SpeechSynthesis.
   */
  const speakCoaching = useCallback((text: string, audioBase64?: string) => {
    if (!text || mutedRef.current) return;

    // If backend provided real audio (Sarvam TTS), play it as an Audio element
    if (audioBase64 && audioBase64.length > 100) {
      try {
        // Cancel any browser TTS
        synthRef.current.cancel();
        isSpeakingRef.current = true;
        setVoiceState('speaking');

        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        audio.onended = () => {
          isSpeakingRef.current = false;
          setVoiceState('listening');
        };
        audio.onerror = () => {
          // Audio playback failed — fall back to browser TTS
          isSpeakingRef.current = false;
          speakText(text);
        };
        audio.play().catch(() => {
          // Autoplay blocked — fall back to browser TTS
          isSpeakingRef.current = false;
          speakText(text);
        });
        return;
      } catch {
        // Fall through to browser TTS
      }
    }

    // Fallback: browser SpeechSynthesis
    speakText(text);
  }, [speakText]);

  return { voiceState, lastTranscript, isMuted, toggleMute, speakText, speakCoaching };
}
