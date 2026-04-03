/**
 * Coach Engine — Orchestrates form scoring results + user speech
 * into timely coaching interventions via Gemini + Sarvam.
 *
 * Rate-limits coaching to avoid over-talking:
 *  - Form-triggered: at most once every 8 seconds
 *  - Rep milestone: every completed rep can trigger brief feedback
 *  - User-initiated: when user asks a question (via STT)
 *  - Set transition: when starting a new set or exercise
 */

import { getCoachingFeedback, resetChatSession, type CoachingContext } from './geminiClient';
import { textToSpeech } from './sarvamClient';

interface SessionState {
  exerciseName: string;
  exerciseId: string;
  currentScore: number;
  currentIssues: string[];
  repCount: number;
  setNumber: number;
  targetReps: number;
  targetSets: number;
  recentRepScores: number[];
  userGoals?: string;
  userExperience?: 'beginner' | 'intermediate' | 'advanced';
  language: string;
}

export interface CoachResponse {
  text: string;
  audioBase64: string;
  trigger: 'form' | 'rep' | 'user_speech' | 'set_transition' | 'session_start' | 'session_end';
}

const MIN_FORM_INTERVAL_MS = 6000;  // Coach every 6s on form issues
const MIN_REP_INTERVAL_MS = 2000;   // Quick rep callouts every 2s
const MIN_MOTIVATION_INTERVAL_MS = 12000; // Encouragement every 12s
const URGENT_FORM_INTERVAL_MS = 3000; // Urgent interruption every 3s for bad form

export class CoachEngine {
  private sessionState: SessionState;
  private sessionId: string;
  private lastFormCoachTime = 0;
  private lastRepCoachTime = 0;
  private lastMotivationTime = 0;
  private lastRepCounted = 0;
  private lastUrgentCoachTime = 0;
  private lastUserSpeechTime = 0;           // Suppress auto-coaching after user speech
  private userSpeechInProgress = false;      // True while STT→Gemini→TTS pipeline runs
  private abortController: AbortController | null = null;

  constructor(
    sessionId: string,
    exerciseName: string,
    exerciseId: string,
    targetReps: number,
    targetSets: number,
    userGoals?: string,
    userExperience?: 'beginner' | 'intermediate' | 'advanced',
    language: string = 'hi-IN',
  ) {
    this.sessionId = sessionId;
    this.sessionState = {
      exerciseName,
      exerciseId,
      currentScore: 100,
      currentIssues: [],
      repCount: 0,
      setNumber: 1,
      targetReps,
      targetSets,
      recentRepScores: [],
      userGoals,
      userExperience,
      language,
    };
  }

  /** Set the coaching language at runtime. */
  setLanguage(language: string) {
    this.sessionState.language = language;
  }

  /** Update the live form score from frontend pose events. */
  updateFormScore(score: number, issues: string[]) {
    this.sessionState.currentScore = score;
    this.sessionState.currentIssues = issues;
  }

  /** Update rep count. */
  updateRepCount(repCount: number, repScore?: number) {
    this.sessionState.repCount = repCount;
    if (repScore !== undefined) {
      this.sessionState.recentRepScores.push(repScore);
      if (this.sessionState.recentRepScores.length > 5) {
        this.sessionState.recentRepScores.shift();
      }
    }
  }

  /** Update set number. */
  updateSet(setNumber: number) {
    this.sessionState.setNumber = setNumber;
    this.sessionState.repCount = 0;
    this.sessionState.recentRepScores = [];
  }

  /**
   * Check if form-triggered coaching should fire.
   * Triggers when score drops below 75 and enough time has passed.
   */
  async checkFormCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastFormCoachTime < MIN_FORM_INTERVAL_MS) return null;
    if (this.userSpeechInProgress || now - this.lastUserSpeechTime < 5000) return null;
    if (this.sessionState.currentScore >= 75) return null;
    if (this.sessionState.currentIssues.length === 0) return null;

    this.lastFormCoachTime = now;
    return this.generateCoaching('form');
  }

  /**
   * PROACTIVE urgent form interruption — like a real desi gym trainer.
   * Fires when form is bad (score < 50) with shorter interval.
   * Also interrupts if issues persist for 2+ consecutive checks.
   */
  async checkUrgentFormInterruption(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastUrgentCoachTime < URGENT_FORM_INTERVAL_MS) return null;
    if (this.sessionState.currentScore >= 50) return null;
    if (this.sessionState.currentIssues.length === 0) return null;

    this.lastUrgentCoachTime = now;
    this.lastFormCoachTime = now; // Also reset regular form coaching timer

    // Try Gemini first for intelligent urgent coaching, fall back to hardcoded
    let text: string;
    try {
      const ctx: CoachingContext = {
        ...this.sessionState,
        userTranscript: '',
      };
      text = await getCoachingFeedback(ctx, this.sessionId);
    } catch {
      const isHindi = this.sessionState.language.startsWith('hi');
      const issue = this.sessionState.currentIssues[0];
      const hindiUrgent = [
        `Arre ruko! ${issue}. Pehle form theek karo!`,
        `Nahi nahi! Galat ho raha hai. ${issue}!`,
        `Stop! Form bahut kharab hai. ${issue}. Dheere karo!`,
        `Bhai dhyan se! ${issue}. Injury ho jayegi!`,
        `Arre! ${issue}. Ruko aur theek se karo!`,
      ];
      const enUrgent = [
        `Stop! ${issue}. Fix your form now!`,
        `No no no! ${issue}. Slow down and correct it!`,
        `Hey! Your form is off. ${issue}!`,
        `Watch it! ${issue}. You'll get hurt!`,
        `Hold on! ${issue}. Fix that before the next rep!`,
      ];
      const pool = isHindi ? hindiUrgent : enUrgent;
      text = pool[Math.floor(Math.random() * pool.length)];
    }

    let audioBase64 = '';
    try {
      const tts = await textToSpeech(text, this.sessionState.language);
      audioBase64 = tts.audioBase64;
    } catch (ttsErr) {
      console.warn('[CoachEngine] TTS failed for urgent coaching:', ttsErr);
    }
    return { text, audioBase64, trigger: 'form' };
  }

  /**
   * Periodic motivation - fires every ~15s regardless of score.
   * Keeps the coach engaged and talking even when form is good.
   */
  async checkMotivationCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastMotivationTime < MIN_MOTIVATION_INTERVAL_MS) return null;
    if (this.userSpeechInProgress || now - this.lastUserSpeechTime < 5000) return null;
    this.lastMotivationTime = now;
    return this.generateCoaching('form');
  }

  /**
   * Check if rep-milestone coaching should fire.
   * Quick encouragement after each completed rep.
   */
  async checkRepCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastRepCoachTime < MIN_REP_INTERVAL_MS) return null;
    if (this.sessionState.repCount <= this.lastRepCounted) return null;

    this.lastRepCounted = this.sessionState.repCount;
    this.lastRepCoachTime = now;
    return this.generateCoaching('rep');
  }

  /** Generate coaching for user speech input. */
  async handleUserSpeech(transcript: string): Promise<CoachResponse | null> {
    if (!transcript.trim()) return null;

    // Cancel any in-flight coaching and suppress auto-coaching
    this.cancelPending();
    this.userSpeechInProgress = true;
    this.lastUserSpeechTime = Date.now();

    const ctx: CoachingContext = {
      ...this.sessionState,
      userTranscript: transcript,
    };

    try {
      const text = await getCoachingFeedback(ctx, this.sessionId);
      let audioBase64 = '';
      try {
        const tts = await textToSpeech(text, this.sessionState.language);
        audioBase64 = tts.audioBase64;
      } catch (ttsErr) {
        console.warn('[CoachEngine] TTS failed, sending text-only response:', ttsErr);
      }
      this.lastUserSpeechTime = Date.now(); // Reset after response is ready
      return { text, audioBase64, trigger: 'user_speech' };
    } catch (err) {
      console.error('[CoachEngine] user speech coaching error:', err);
      // Fallback response so user always gets an answer
      const isHindi = this.sessionState.language.startsWith('hi');
      const fallbackText = isHindi
        ? `Main sun raha hoon! Aapka form ${this.sessionState.currentScore}% hai. Aur kuch puchna hai?`
        : `I hear you! Your form score is ${this.sessionState.currentScore}%. What else would you like to know?`;
      let audioBase64 = '';
      try {
        const tts = await textToSpeech(fallbackText, this.sessionState.language);
        audioBase64 = tts.audioBase64;
      } catch { /* TTS optional */ }
      return { text: fallbackText, audioBase64, trigger: 'user_speech' };
    } finally {
      this.userSpeechInProgress = false;
    }
  }

  /** Generate session start greeting. */
  async generateSessionStart(): Promise<CoachResponse> {
    const isHindi = this.sessionState.language.startsWith('hi');
    const text = isHindi
      ? `Chalo ${this.sessionState.exerciseName} karte hain! ${this.sessionState.targetSets} sets, har set mein ${this.sessionState.targetReps} reps. Taiyaar ho jao!`
      : `Let's do ${this.sessionState.exerciseName}! ${this.sessionState.targetSets} sets of ${this.sessionState.targetReps}. Get ready!`;
    let audioBase64 = '';
    try {
      const tts = await textToSpeech(text, this.sessionState.language);
      audioBase64 = tts.audioBase64;
    } catch { /* TTS optional */ }
    return { text, audioBase64, trigger: 'session_start' };
  }

  /** Generate set transition announcement. */
  async generateSetTransition(): Promise<CoachResponse> {
    const remaining = this.sessionState.targetSets - this.sessionState.setNumber + 1;
    const isHindi = this.sessionState.language.startsWith('hi');
    const text = remaining > 0
      ? (isHindi
          ? `Set ${this.sessionState.setNumber} done! ${remaining} sets aur baki. Thoda rest lo.`
          : `Set ${this.sessionState.setNumber} done! ${remaining} sets to go. Rest up.`)
      : (isHindi ? 'Last set khatam! Zabardast workout!' : 'Last set done! Great workout!');
    let audioBase64 = '';
    try {
      const tts = await textToSpeech(text, this.sessionState.language);
      audioBase64 = tts.audioBase64;
    } catch { /* TTS optional */ }
    return { text, audioBase64, trigger: 'set_transition' };
  }

  /** Generate session end summary. */
  async generateSessionEnd(totalReps: number, avgScore: number): Promise<CoachResponse> {
    const isHindi = this.sessionState.language.startsWith('hi');
    const scoreLabel = isHindi
      ? (avgScore >= 80 ? 'excellent' : avgScore >= 60 ? 'accha' : 'aur practice chahiye')
      : (avgScore >= 80 ? 'excellent' : avgScore >= 60 ? 'solid' : 'needs work');
    const text = isHindi
      ? `Workout complete! ${totalReps} total reps, form ${scoreLabel} ${avgScore}% ke saath. Bahut badhiya!`
      : `Workout complete! ${totalReps} total reps with ${scoreLabel} form at ${avgScore}%. Nice job!`;
    let audioBase64 = '';
    try {
      const tts = await textToSpeech(text, this.sessionState.language);
      audioBase64 = tts.audioBase64;
    } catch { /* TTS optional */ }
    return { text, audioBase64, trigger: 'session_end' };
  }

  /** Cancel any in-flight coaching generation (for interruptibility). */
  cancelPending() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async generateCoaching(trigger: CoachResponse['trigger']): Promise<CoachResponse | null> {
    this.abortController = new AbortController();

    let text: string;
    try {
      text = await getCoachingFeedback(this.sessionState, this.sessionId);
      if (this.abortController.signal.aborted) return null;
    } catch (err) {
      if (this.abortController?.signal.aborted) return null;
      // Gemini unavailable — use hardcoded coaching so the coach never goes silent
      text = this.getFallbackCoaching(trigger);
      if (!text) return null;
    }

    let audioBase64 = '';
    try {
      const tts = await textToSpeech(text, this.sessionState.language);
      if (this.abortController.signal.aborted) return null;
      audioBase64 = tts.audioBase64;
    } catch (ttsErr) {
      // TTS unavailable — browser SpeechSynthesis will handle it on frontend
    }

    this.abortController = null;
    return { text, audioBase64, trigger };
  }

  /**
   * Hardcoded coaching text when Gemini is unavailable.
   * Ensures the coach ALWAYS speaks — never goes silent.
   */
  private getFallbackCoaching(trigger: CoachResponse['trigger']): string {
    const isHindi = this.sessionState.language.startsWith('hi');
    const { currentScore, currentIssues, repCount, targetReps, setNumber, targetSets, exerciseName } = this.sessionState;
    const issue = currentIssues[0] || '';

    if (trigger === 'form') {
      if (currentScore < 40) {
        const pool = isHindi
          ? [`Arre! ${issue}. Dheere karo aur form pe dhyan do!`, `Nahi nahi! ${issue}. Pehle form theek karo bhai!`, `Ruko! ${issue}. Injury ho jayegi! Dhyan se karo.`]
          : [`Stop! ${issue}. Slow down and fix your form!`, `No no! ${issue}. Fix that before the next rep!`, `Watch out! ${issue}. Focus on form, not speed!`];
        return pool[Math.floor(Math.random() * pool.length)];
      } else if (currentScore < 70) {
        const pool = isHindi
          ? [`${issue}. Thoda aur theek karo, almost correct hai!`, `Accha hai lekin ${issue}. Thoda adjust karo.`, `${issue} pe dhyan do. Baaki sab sahi hai!`]
          : [`Almost there! ${issue}. Small adjustment needed.`, `Good effort! Just fix ${issue} and you're golden.`, `Watch your ${issue}. Everything else looks solid!`];
        return pool[Math.floor(Math.random() * pool.length)];
      } else {
        const pool = isHindi
          ? ['Bahut badhiya form! Aise hi karte raho!', 'Ekdum perfect! Keep going!', 'Zabardast! Form bilkul sahi hai. Maza aa gaya!', 'Shandar! Aise hi aage badho champion!']
          : ['Perfect form! Keep it up!', 'Excellent! Your form looks great!', 'Amazing technique! You are crushing it!', 'Textbook form! Keep pushing!'];
        return pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (trigger === 'rep') {
      const remaining = targetReps - repCount;
      if (remaining <= 0) {
        return isHindi ? `${repCount} reps done! Set complete! Bahut badhiya!` : `${repCount} reps! Set complete! Great work!`;
      }
      if (remaining <= 3) {
        return isHindi ? `${repCount} reps ho gaye! Bas ${remaining} aur! Push karo!` : `${repCount} reps done! Just ${remaining} more! Push through!`;
      }
      const pool = isHindi
        ? [`Nice! ${repCount} reps. Aage badho!`, `${repCount}! Bahut accha chal raha hai. Keep going!`, `That's ${repCount}! Mast chal raha hai!`]
        : [`Nice, that's ${repCount}! Keep going!`, `Rep ${repCount} done! Looking strong!`, `${repCount} and counting! Great pace!`];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // Motivation / general
    const pool = isHindi
      ? [`Chal raha hai ${exerciseName}! Set ${setNumber} of ${targetSets}. Mehnat rang layegi!`, `Bahut accha! Aapki form acchi hai. Aur push karo!`, `Champion! Thoda aur effort lagao!`]
      : [`Doing great on ${exerciseName}! Set ${setNumber} of ${targetSets}. Keep pushing!`, `Your form is looking solid! Keep that energy up!`, `You got this! Almost there, champion!`];
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
