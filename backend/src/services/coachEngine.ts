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
}

export interface CoachResponse {
  text: string;
  audioBase64: string;
  trigger: 'form' | 'rep' | 'user_speech' | 'set_transition' | 'session_start' | 'session_end';
}

const MIN_FORM_INTERVAL_MS = 8000;  // Don't nag more than once every 8s
const MIN_REP_INTERVAL_MS = 3000;   // At least 3s between rep callouts
const MIN_MOTIVATION_INTERVAL_MS = 15000; // Periodic encouragement every 15s

export class CoachEngine {
  private sessionState: SessionState;
  private sessionId: string;
  private lastFormCoachTime = 0;
  private lastRepCoachTime = 0;
  private lastMotivationTime = 0;
  private lastRepCounted = 0;
  private abortController: AbortController | null = null;

  constructor(
    sessionId: string,
    exerciseName: string,
    exerciseId: string,
    targetReps: number,
    targetSets: number,
    userGoals?: string,
    userExperience?: 'beginner' | 'intermediate' | 'advanced',
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
    };
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
   * Triggers when score drops below 60 and enough time has passed.
   */
  async checkFormCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastFormCoachTime < MIN_FORM_INTERVAL_MS) return null;
    if (this.sessionState.currentScore >= 75) return null;
    if (this.sessionState.currentIssues.length === 0) return null;

    this.lastFormCoachTime = now;
    return this.generateCoaching('form');
  }

  /**
   * Periodic motivation - fires every ~15s regardless of score.
   * Keeps the coach engaged and talking even when form is good.
   */
  async checkMotivationCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastMotivationTime < MIN_MOTIVATION_INTERVAL_MS) return null;
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

    // Cancel any in-flight coaching
    this.cancelPending();

    const ctx: CoachingContext = {
      ...this.sessionState,
      userTranscript: transcript,
    };

    try {
      const text = await getCoachingFeedback(ctx, this.sessionId);
      const tts = await textToSpeech(text);
      return { text, audioBase64: tts.audioBase64, trigger: 'user_speech' };
    } catch (err) {
      console.error('[CoachEngine] user speech coaching error:', err);
      return null;
    }
  }

  /** Generate session start greeting. */
  async generateSessionStart(): Promise<CoachResponse> {
    const text = `Let's do ${this.sessionState.exerciseName}! ${this.sessionState.targetSets} sets of ${this.sessionState.targetReps}. Get ready!`;
    const tts = await textToSpeech(text);
    return { text, audioBase64: tts.audioBase64, trigger: 'session_start' };
  }

  /** Generate set transition announcement. */
  async generateSetTransition(): Promise<CoachResponse> {
    const remaining = this.sessionState.targetSets - this.sessionState.setNumber + 1;
    const text = remaining > 0
      ? `Set ${this.sessionState.setNumber} done! ${remaining} sets to go. Rest up.`
      : 'Last set done! Great workout!';
    const tts = await textToSpeech(text);
    return { text, audioBase64: tts.audioBase64, trigger: 'set_transition' };
  }

  /** Generate session end summary. */
  async generateSessionEnd(totalReps: number, avgScore: number): Promise<CoachResponse> {
    const scoreLabel = avgScore >= 80 ? 'excellent' : avgScore >= 60 ? 'solid' : 'needs work';
    const text = `Workout complete! ${totalReps} total reps with ${scoreLabel} form at ${avgScore}%. Nice job!`;
    const tts = await textToSpeech(text);
    return { text, audioBase64: tts.audioBase64, trigger: 'session_end' };
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

    try {
      const text = await getCoachingFeedback(this.sessionState, this.sessionId);
      if (this.abortController.signal.aborted) return null;

      const tts = await textToSpeech(text);
      if (this.abortController.signal.aborted) return null;

      return { text, audioBase64: tts.audioBase64, trigger };
    } catch (err) {
      if (this.abortController?.signal.aborted) return null;
      console.error('[CoachEngine] coaching error:', err);
      return null;
    } finally {
      this.abortController = null;
    }
  }
}
