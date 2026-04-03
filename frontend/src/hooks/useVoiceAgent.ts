/**
 * useVoiceAgent — Coach-only TTS voice output using Web Speech API.
 *
 * The coach OBSERVES and SPEAKS — no listening (STT disabled).
 * Uses SpeechSynthesis with smart voice selection for natural output.
 *
 * Features:
 *  - Natural-sounding TTS with Google/Microsoft voice preference
 *  - Plays Sarvam audioBase64 when available (natural Hindi TTS)
 *  - Smart interruptibility: new coaching cancels previous speech
 *  - Long text split into sentences to avoid Chrome 15s cutoff
 *  - Rate/pitch tuned for authoritative gym trainer persona
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoachingMessage } from '../types';

interface UseVoiceAgentOptions {
  sessionId: string | null;
  isActive: boolean;
  language?: string;
  onCoaching?: (msg: CoachingMessage) => void;
}

interface UseVoiceAgentResult {
  voiceState: 'idle' | 'speaking';
  isMuted: boolean;
  toggleMute: () => void;
  /** Speak text via browser SpeechSynthesis */
  speakText: (text: string) => void;
  /** Play backend audioBase64 if available, else fall back to speakText */
  speakCoaching: (text: string, audioBase64?: string) => void;
  /** Stop any currently playing speech */
  stopSpeaking: () => void;
}

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
  language = 'en-IN',
  onCoaching,
}: UseVoiceAgentOptions): UseVoiceAgentResult {
  const [voiceState, setVoiceState] = useState<'idle' | 'speaking'>('idle');
  const [isMuted, setIsMuted] = useState(false);

  const mutedRef = useRef(false);
  const synthRef = useRef(window.speechSynthesis);
  const isSpeakingRef = useRef(false);
  const cachedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const cachedVoiceLangRef = useRef<string>('');
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const onCoachingRef = useRef(onCoaching);
  onCoachingRef.current = onCoaching;
  const languageRef = useRef(language);
  languageRef.current = language;

  // ── Preload voices on mount (Chrome loads asynchronously) ──
  useEffect(() => {
    const synth = window.speechSynthesis;
    synth.getVoices();
    const handleVoicesChanged = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        const best = selectBestVoice(voices, languageRef.current);
        if (best) {
          cachedVoiceRef.current = best;
          cachedVoiceLangRef.current = languageRef.current;
          console.log(`[Voice] Selected: "${best.name}" (${best.lang})`);
        }
      }
    };
    synth.addEventListener('voiceschanged', handleVoicesChanged);
    handleVoicesChanged();
    return () => synth.removeEventListener('voiceschanged', handleVoicesChanged);
  }, []);

  // Update cached voice when language changes
  useEffect(() => {
    if (cachedVoiceLangRef.current !== language) {
      const voices = synthRef.current.getVoices();
      const best = selectBestVoice(voices, language);
      if (best) {
        cachedVoiceRef.current = best;
        cachedVoiceLangRef.current = language;
      }
    }
  }, [language]);

  // Stop all audio when session ends
  useEffect(() => {
    if (!isActive) {
      synthRef.current.cancel();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      isSpeakingRef.current = false;
      setVoiceState('idle');
    }
  }, [isActive]);

  const stopSpeaking = useCallback(() => {
    synthRef.current.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isSpeakingRef.current = false;
    setVoiceState('idle');
  }, []);

  // ── TTS: Speak coaching text via browser SpeechSynthesis ──
  const speakText = useCallback((text: string) => {
    if (!text || mutedRef.current) return;

    try {
      const synth = synthRef.current;
      synth.cancel();

      const langCode = languageRef.current || 'en-IN';

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

      // Gym trainer voice settings: confident, authoritative, slightly fast
      const RATE = 1.05;
      const PITCH = 0.9;

      // Chrome bug: long utterances cut off at ~15s. Split into sentences.
      if (text.length > 150) {
        const sentences = (text.match(/[^.!?।]+[.!?।]?\s*/g) || [text]).filter(s => s.trim().length > 0);
        let i = 0;
        function speakNext() {
          if (i >= sentences.length || mutedRef.current) {
            isSpeakingRef.current = false;
            setVoiceState('idle');
            return;
          }
          const chunk = new SpeechSynthesisUtterance(sentences[i].trim());
          if (cachedVoiceRef.current) chunk.voice = cachedVoiceRef.current;
          chunk.lang = langCode;
          chunk.rate = RATE;
          chunk.pitch = PITCH;
          chunk.volume = 1.0;
          chunk.onend = () => { i++; speakNext(); };
          chunk.onerror = () => { isSpeakingRef.current = false; setVoiceState('idle'); };
          synth.speak(chunk);
        }
        speakNext();
      } else {
        const utterance = new SpeechSynthesisUtterance(text);
        if (cachedVoiceRef.current) utterance.voice = cachedVoiceRef.current;
        utterance.lang = langCode;
        utterance.rate = RATE;
        utterance.pitch = PITCH;
        utterance.volume = 1.0;
        utterance.onend = () => {
          isSpeakingRef.current = false;
          setVoiceState('idle');
        };
        utterance.onerror = () => {
          isSpeakingRef.current = false;
          setVoiceState('idle');
        };
        synth.speak(utterance);
      }
    } catch {
      isSpeakingRef.current = false;
      setVoiceState('idle');
    }
  }, []);

  /**
   * Play Sarvam audioBase64 if available, otherwise fall back to browser TTS.
   */
  const speakCoaching = useCallback((text: string, audioBase64?: string) => {
    if (!text || mutedRef.current) return;

    if (audioBase64 && audioBase64.length > 100) {
      try {
        synthRef.current.cancel();
        if (currentAudioRef.current) currentAudioRef.current.pause();

        isSpeakingRef.current = true;
        setVoiceState('speaking');

        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        currentAudioRef.current = audio;
        audio.onended = () => {
          isSpeakingRef.current = false;
          setVoiceState('idle');
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          isSpeakingRef.current = false;
          currentAudioRef.current = null;
          speakText(text);
        };
        audio.play().catch(() => {
          isSpeakingRef.current = false;
          currentAudioRef.current = null;
          speakText(text);
        });
        return;
      } catch { /* fall through */ }
    }

    speakText(text);
  }, [speakText]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (next) {
        synthRef.current.cancel();
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        isSpeakingRef.current = false;
        setVoiceState('idle');
      }
      return next;
    });
  }, []);

  return { voiceState, isMuted, toggleMute, speakText, speakCoaching, stopSpeaking };
}
