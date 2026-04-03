/**
 * Coach Engine — The "Desi Gym Trainer" personality engine.
 *
 * The coach OBSERVES poses and delivers real-time coaching.
 * No listening to user speech — coach is proactive only.
 *
 * Personality traits:
 *  - Encouraging when form is good, ANGRY when it's bad repeatedly
 *  - Tracks which issues repeat → escalates tone (calm → firm → angry → furious)
 *  - Never repeats the same exact line twice in a row
 *  - Uses issue-specific corrections, not generic phrases
 *  - Mixes Hindi/English naturally (Hinglish gym bro style)
 *  - Gets genuinely frustrated when the same mistake happens 3+ times
 *
 * Rate-limits:
 *  - Form coaching: every 5s
 *  - Rep callouts: every 2s
 *  - Motivation: every 10s
 *  - Urgent interruption: every 3s for dangerously bad form
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

const MIN_FORM_INTERVAL_MS = 5000;
const MIN_REP_INTERVAL_MS = 2000;
const MIN_MOTIVATION_INTERVAL_MS = 10000;
const URGENT_FORM_INTERVAL_MS = 3000;

/**
 * Anger level determines the tone of coaching.
 * Escalates as the SAME issue repeats without correction.
 */
type AngerLevel = 0 | 1 | 2 | 3;  // calm | firm | angry | furious

export class CoachEngine {
  private sessionState: SessionState;
  private sessionId: string;

  // Timing trackers — prevent over-talking
  private lastFormCoachTime = 0;
  private lastRepCoachTime = 0;
  private lastMotivationTime = 0;
  private lastRepCounted = 0;
  private lastUrgentCoachTime = 0;
  private abortController: AbortController | null = null;

  // -- Anti-repetition system --
  // Ring buffer of last N spoken lines — never repeat something said recently
  private recentLines: string[] = [];
  private static readonly MAX_RECENT = 12;

  // -- Anger escalation system --
  // Track how many times each specific issue fires consecutively
  private issueStreaks: Map<string, number> = new Map();
  // Which issues were present on the PREVIOUS coaching check
  private previousIssues: Set<string> = new Set();

  constructor(
    sessionId: string,
    exerciseName: string,
    exerciseId: string,
    targetReps: number,
    targetSets: number,
    userGoals?: string,
    userExperience?: 'beginner' | 'intermediate' | 'advanced',
    language: string = 'en-IN',
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

  setLanguage(language: string) {
    this.sessionState.language = language;
  }

  updateFormScore(score: number, issues: string[]) {
    this.sessionState.currentScore = score;
    this.sessionState.currentIssues = issues;
    this.updateIssueStreaks(issues);
  }

  updateRepCount(repCount: number, repScore?: number) {
    this.sessionState.repCount = repCount;
    if (repScore !== undefined) {
      this.sessionState.recentRepScores.push(repScore);
      if (this.sessionState.recentRepScores.length > 5) {
        this.sessionState.recentRepScores.shift();
      }
    }
  }

  updateSet(setNumber: number) {
    this.sessionState.setNumber = setNumber;
    this.sessionState.repCount = 0;
    this.sessionState.recentRepScores = [];
    // New set = fresh start for anger
    this.issueStreaks.clear();
    this.previousIssues.clear();
  }

  // ─── Issue streak tracking ───────────────────────────────────
  /**
   * For each issue currently present: if it was also present last time,
   * increment the streak. If it's new, start at 1. Issues that disappeared
   * get their streak reset to 0.
   */
  private updateIssueStreaks(currentIssues: string[]) {
    const current = new Set(currentIssues);
    // Increment streak for persisting issues, start at 1 for new ones
    for (const issue of current) {
      const prev = this.issueStreaks.get(issue) || 0;
      this.issueStreaks.set(issue, this.previousIssues.has(issue) ? prev + 1 : 1);
    }
    // Reset streak for issues that were fixed
    for (const old of this.previousIssues) {
      if (!current.has(old)) this.issueStreaks.set(old, 0);
    }
    this.previousIssues = current;
  }

  /** Compute anger level from the worst issue streak. */
  private getAngerLevel(): AngerLevel {
    let maxStreak = 0;
    for (const streak of this.issueStreaks.values()) {
      if (streak > maxStreak) maxStreak = streak;
    }
    if (maxStreak >= 6) return 3;  // furious — same mistake 6+ times
    if (maxStreak >= 4) return 2;  // angry
    if (maxStreak >= 2) return 1;  // firm
    return 0;                       // calm
  }

  // ─── Anti-repetition ─────────────────────────────────────────
  /** Pick a random line from the pool that wasn't said recently. */
  private pickFresh(pool: string[]): string {
    const unused = pool.filter(l => !this.recentLines.includes(l));
    const pick = unused.length > 0
      ? unused[Math.floor(Math.random() * unused.length)]
      : pool[Math.floor(Math.random() * pool.length)];
    this.recentLines.push(pick);
    if (this.recentLines.length > CoachEngine.MAX_RECENT) this.recentLines.shift();
    return pick;
  }

  // ─── Coaching checks ─────────────────────────────────────────

  async checkFormCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastFormCoachTime < MIN_FORM_INTERVAL_MS) return null;
    if (this.sessionState.currentScore >= 75) return null;
    if (this.sessionState.currentIssues.length === 0) return null;
    this.lastFormCoachTime = now;
    return this.generateCoaching('form');
  }

  async checkUrgentFormInterruption(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastUrgentCoachTime < URGENT_FORM_INTERVAL_MS) return null;
    if (this.sessionState.currentScore >= 50) return null;
    if (this.sessionState.currentIssues.length === 0) return null;
    this.lastUrgentCoachTime = now;
    this.lastFormCoachTime = now;
    return this.generateCoaching('form');
  }

  async checkMotivationCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastMotivationTime < MIN_MOTIVATION_INTERVAL_MS) return null;
    this.lastMotivationTime = now;
    return this.generateCoaching('form');
  }

  async checkRepCoaching(): Promise<CoachResponse | null> {
    const now = Date.now();
    if (now - this.lastRepCoachTime < MIN_REP_INTERVAL_MS) return null;
    if (this.sessionState.repCount <= this.lastRepCounted) return null;
    this.lastRepCounted = this.sessionState.repCount;
    this.lastRepCoachTime = now;
    return this.generateCoaching('rep');
  }

  // ─── Session lifecycle ────────────────────────────────────────

  async generateSessionStart(): Promise<CoachResponse> {
    const { exerciseName, targetSets, targetReps } = this.sessionState;
    const greetings = [
      `Alright, let's go! ${exerciseName}, ${targetSets} sets of ${targetReps}. I'm watching every rep, so don't slack off!`,
      `${exerciseName} time! ${targetSets} sets, ${targetReps} reps each. Show me what you've got. No excuses!`,
      `Let's crush these ${exerciseName}! ${targetSets} sets of ${targetReps}. I'll be right here coaching you through every single rep.`,
      `Okay champ, ${exerciseName}. ${targetSets} sets, ${targetReps} reps. Let's see that perfect form. Ready? Go!`,
      `Time for ${exerciseName}! ${targetSets} sets of ${targetReps}. I'll tell you exactly when your form slips. Let's do this!`,
    ];
    const text = this.pickFresh(greetings);
    const audioBase64 = await this.tryTTS(text);
    return { text, audioBase64, trigger: 'session_start' };
  }

  async generateSetTransition(): Promise<CoachResponse> {
    const { setNumber, targetSets } = this.sessionState;
    const remaining = targetSets - setNumber + 1;
    const pool = remaining > 0
      ? [
          `Set ${setNumber} done! ${remaining} more to go. Shake it out, take a breath, and let's go again!`,
          `That's set ${setNumber} in the books! ${remaining} sets left. Rest up for 30 seconds, then we're back at it.`,
          `Set ${setNumber} complete! Don't get comfortable — ${remaining} more sets waiting for you.`,
          `Good set! ${remaining} to go. Quick rest, stay focused. Next set needs to be even better.`,
          `Set ${setNumber}, done! ${remaining} remaining. I want cleaner reps this time, let's go!`,
        ]
      : [
          `Last set CRUSHED! That's all sets done! Incredible work today!`,
          `And that's a wrap! All sets complete. You showed up and gave it your all!`,
          `DONE! Every single set, every single rep. That's what I'm talking about!`,
          `All sets finished! You pushed through like a champion. Be proud of that!`,
        ];
    const text = this.pickFresh(pool);
    const audioBase64 = await this.tryTTS(text);
    return { text, audioBase64, trigger: 'set_transition' };
  }

  async generateSessionEnd(totalReps: number, avgScore: number): Promise<CoachResponse> {
    const grade = avgScore >= 80 ? 'excellent' : avgScore >= 60 ? 'solid' : 'needs improvement';
    const pool = [
      `Workout complete! ${totalReps} reps done, average form score ${avgScore}%. That's ${grade} work. See you next session!`,
      `You did it! ${totalReps} total reps with a ${avgScore}% form average. ${grade === 'excellent' ? 'Absolutely amazing!' : grade === 'solid' ? 'Really good effort!' : 'We need to work on that form, but at least you showed up.'}`,
      `${totalReps} reps in the bag! Form score: ${avgScore}%. ${grade === 'excellent' ? 'You killed it today!' : grade === 'solid' ? 'Consistent work, keep it up!' : 'Not your best day, but consistency matters more. Come back stronger.'}`,
      `Session over! ${totalReps} reps, ${avgScore}% form. ${grade === 'needs improvement' ? 'Listen, bad days happen. What matters is you came back. See you next time.' : 'That was impressive. Recovery, nutrition, sleep. Come back ready!'}`,
    ];
    const text = this.pickFresh(pool);
    // Reset anger state for next session
    this.issueStreaks.clear();
    this.previousIssues.clear();
    this.recentLines = [];
    const audioBase64 = await this.tryTTS(text);
    return { text, audioBase64, trigger: 'session_end' };
  }

  cancelPending() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ─── Core coaching generation ─────────────────────────────────

  private async generateCoaching(trigger: CoachResponse['trigger']): Promise<CoachResponse | null> {
    this.abortController = new AbortController();

    let text: string;
    try {
      text = await getCoachingFeedback(this.sessionState, this.sessionId);
      if (this.abortController.signal.aborted) return null;
    } catch {
      if (this.abortController?.signal.aborted) return null;
      text = this.getFallbackCoaching(trigger);
      if (!text) return null;
    }

    const audioBase64 = await this.tryTTS(text);
    if (this.abortController?.signal.aborted) return null;
    this.abortController = null;
    return { text, audioBase64, trigger };
  }

  /** Attempt TTS, return empty string on failure (frontend SpeechSynthesis fallback). */
  private async tryTTS(text: string): Promise<string> {
    try {
      const tts = await textToSpeech(text, this.sessionState.language);
      return tts.audioBase64;
    } catch {
      return '';
    }
  }

  // ─── Fallback coaching (offline, no Gemini) ───────────────────
  /**
   * Massive text pools organized by:
   *  1. Trigger type (form / rep / motivation)
   *  2. Score range (bad / medium / good)
   *  3. Anger level (escalates with repeated issues)
   *
   * NEVER returns the same line twice in a row thanks to pickFresh().
   */
  private getFallbackCoaching(trigger: CoachResponse['trigger']): string {
    const { currentScore, currentIssues, repCount, targetReps, setNumber, targetSets, exerciseName } = this.sessionState;
    const issue = currentIssues[0] || 'form';
    const anger = this.getAngerLevel();

    if (trigger === 'form') {
      return this.getFormText(currentScore, issue, anger);
    }

    if (trigger === 'rep') {
      return this.getRepText(repCount, targetReps);
    }

    // Motivation / general — keep the energy up
    return this.getMotivationText(exerciseName, setNumber, targetSets, currentScore);
  }

  // ─── FORM COACHING TEXT ───────────────────────────────────────
  private getFormText(score: number, issue: string, anger: AngerLevel): string {
    if (score >= 75) return this.getGoodFormText();
    if (score >= 50) return this.getMediumFormText(issue, anger);
    return this.getBadFormText(issue, anger);
  }

  private getGoodFormText(): string {
    return this.pickFresh([
      'Perfect form! That\'s exactly what I want to see. Keep it up!',
      'Beautiful rep! Your body alignment is spot on right now.',
      'YES! That\'s how you do it. Clean, controlled, perfect.',
      'Textbook form right there! If you could bottle that, you\'d sell it.',
      'Looking sharp! Maintain that exact range of motion.',
      'That\'s it! Every muscle fiber is firing correctly. Don\'t change a thing.',
      'Phenomenal technique! You\'re moving like a pro.',
      'Now THAT is what proper form looks like. More of that please!',
      'Clean as a whistle! Your control is impressive right now.',
      'Smooth and controlled — exactly right. You\'re in the zone!',
      'I couldn\'t coach that any better. That was a picture-perfect rep.',
      'Strong and steady! Keep that core tight, you\'re nailing it.',
    ]);
  }

  private getMediumFormText(issue: string, anger: AngerLevel): string {
    // Calm (anger 0) — encouraging corrections
    if (anger === 0) {
      return this.pickFresh([
        `Almost there! Just watch your ${issue}. Small fix, big difference.`,
        `Good effort! Your ${issue} needs a little attention. You can fix that.`,
        `You\'re close! Focus on correcting that ${issue} and you\'ll be perfect.`,
        `Not bad at all! Just tighten up your ${issue} a bit.`,
        `Solid work! One thing — ${issue}. Fix that and you\'re golden.`,
        `I see you working! Just ${issue} is slightly off. Quick adjustment!`,
        `Decent rep! Pay attention to ${issue}. Everything else is looking good.`,
        `On the right track! Let\'s fix ${issue} on this next rep.`,
      ]);
    }
    // Firm (anger 1) — noticing the pattern
    if (anger === 1) {
      return this.pickFresh([
        `Hey, ${issue} again. I mentioned this before — focus on it now.`,
        `I\'m seeing ${issue} pop up repeatedly. Let\'s fix it this rep, yeah?`,
        `Come on, ${issue} is still there. I know you can correct it. Concentrate!`,
        `Still ${issue}. I need you to actively think about it on the next rep.`,
        `That ${issue} isn\'t going away on its own. Make the correction NOW.`,
        `We\'ve talked about ${issue}. Time to actually fix it, not just hear about it.`,
        `${issue} — again. Pull it together. I want to see improvement.`,
        `Listen, ${issue} keeps showing up. That tells me you\'re not focusing.`,
      ]);
    }
    // Angry (anger 2) — visibly frustrated
    if (anger === 2) {
      return this.pickFresh([
        `Seriously?! ${issue} STILL?! How many times do I have to say it?!`,
        `I\'m getting frustrated here. ${issue} over and over. FOCUS!`,
        `Bro, ${issue}. AGAIN. Are you even listening to your coach?!`,
        `${issue}! I\'ve told you multiple times now. What\'s going on?!`,
        `This is getting ridiculous. ${issue}. FIX IT or we stop.`,
        `I can\'t keep saying the same thing. ${issue}. CORRECT IT NOW!`,
        `Your ${issue} is driving me crazy! Come on, you\'re better than this!`,
        `How many more times? ${issue}! I need you to actually make the change!`,
      ]);
    }
    // Furious (anger 3) — last straw
    return this.pickFresh([
      `I\'m about to lose it! ${issue} for the HUNDREDTH time! STOP and reset your position!`,
      `ENOUGH! ${issue}! If you can\'t fix it, drop the weight and do it right!`,
      `I refuse to watch you hurt yourself! ${issue}! STOP RIGHT NOW and fix your positioning!`,
      `That\'s IT! ${issue} AGAIN?! Slow everything down. Half speed. Get the form right or don\'t do it at all!`,
      `YOU ARE NOT LISTENING! ${issue}! I swear if I see it one more time I\'m stopping this set!`,
      `UNACCEPTABLE! ${issue}! Reset. Breathe. Start the movement from scratch. Properly this time!`,
      `I don\'t care about reps, I care about your joints! ${issue}! Fix it or we\'re done!`,
      `This is dangerous now. ${issue} for the millionth time! STOP, reset, and do it PROPERLY!`,
    ]);
  }

  private getBadFormText(issue: string, anger: AngerLevel): string {
    // Even at calm, bad form gets strong language
    if (anger <= 1) {
      return this.pickFresh([
        `Whoa! Stop! ${issue}. That form is way off. Let\'s reset and try again carefully.`,
        `Hold on! ${issue}. Your form just dropped hard. Slow down, let\'s fix this.`,
        `No no no! ${issue}! That rep didn\'t count. Fix your positioning and go again.`,
        `${issue}! That\'s not safe. Drop the ego, lighten up, and do it right.`,
        `Okay we have a problem — ${issue}. Your form score just tanked. Let\'s correct it now.`,
        `STOP! ${issue}! You\'re going to hurt yourself. Slow down and focus on the movement.`,
        `That was ugly! ${issue}. I need you to breathe, reset, and execute properly.`,
        `${issue}! Your body is compensating. That means you\'re either tired or not paying attention. Which is it?`,
        `Come on now! ${issue}! That rep was all wrong. Let\'s get it right on the next one.`,
        `Bad rep! ${issue}. Don\'t rush. Quality over quantity, always.`,
      ]);
    }
    // Already angry + bad form = explosive
    return this.pickFresh([
      `WHAT WAS THAT?! ${issue}! That\'s not an exercise, that\'s a recipe for injury! STOP!`,
      `Are you TRYING to hurt yourself?! ${issue}! I\'ve been TELLING you this! FIX IT!`,
      `ABSOLUTELY NOT! ${issue}! Drop everything. We\'re going back to basics. Zero weight.`,
      `That was TERRIBLE! ${issue}! I\'m not going to stand here and watch you destroy your joints!`,
      `STOP STOP STOP! ${issue}! I don\'t care how many reps you\'ve done. FORM FIRST!`,
      `I CANNOT believe you\'re still doing ${issue} after everything I\'ve said! HALT!`,
      `If you won\'t listen to your coach, your body will teach you the hard way! ${issue}! FIX IT NOW!`,
      `That\'s DANGEROUS! ${issue}! I\'m serious — one more like that and we\'re ending this set!`,
      `This is a JOKE right?! ${issue}! How am I supposed to coach you if you won\'t even try?!`,
      `NO! Just NO! ${issue} every single rep! Put the weight down, stand up straight, and START OVER!`,
    ]);
  }

  // ─── REP COACHING TEXT ────────────────────────────────────────
  private getRepText(repCount: number, targetReps: number): string {
    const remaining = targetReps - repCount;

    if (remaining <= 0) {
      return this.pickFresh([
        `${repCount} reps! Set complete! That\'s how it\'s done!`,
        `All ${repCount} reps DONE! Brilliant set! Shake it out.`,
        `Set FINISHED! ${repCount} reps in the bag. Take a breather, you earned it!`,
        `BOOM! ${repCount} reps! That set is history. Rest up!`,
        `And that\'s ${repCount}! Set wrapped up! Nice work!`,
      ]);
    }

    if (remaining <= 2) {
      return this.pickFresh([
        `${repCount} done! Just ${remaining} more! DIG DEEP! You\'re right there!`,
        `Almost done! ${remaining} left! Push through the burn!`,
        `So close! ${remaining} more reps! Don\'t you dare quit now!`,
        `${remaining} to go! This is where champions are made! PUSH!`,
        `FINISH STRONG! ${remaining} more! You\'ve got this, don\'t slow down!`,
        `The last ${remaining}! This is the part that counts! GO!`,
      ]);
    }

    if (remaining <= 5) {
      return this.pickFresh([
        `${repCount} reps done! ${remaining} to go. We\'re in the home stretch!`,
        `That\'s ${repCount}! ${remaining} more and you\'re done. Keep that form tight!`,
        `${repCount} and counting! ${remaining} left — don\'t let the form slip now!`,
        `Good pace! ${repCount} done, ${remaining} remaining. Steady and strong!`,
        `Halfway warrior! ${remaining} more. Each rep better than the last!`,
      ]);
    }

    // Early/mid reps — variety of encouragement
    return this.pickFresh([
      `That\'s ${repCount}! Good rhythm, keep it flowing.`,
      `Rep ${repCount}! Looking strong. Maintain that tempo.`,
      `${repCount} and going! Nice control. Keep breathing.`,
      `${repCount} done! Solid reps. Don\'t forget to breathe.`,
      `Rep ${repCount} in! Good power. Stay focused.`,
      `${repCount}! Clean rep. That\'s the standard I want every time.`,
      `Nice one! ${repCount} reps down. Keep that energy!`,
      `${repCount} reps! You\'re building momentum. Keep rolling!`,
    ]);
  }

  // ─── MOTIVATION TEXT ──────────────────────────────────────────
  private getMotivationText(exercise: string, set: number, totalSets: number, score: number): string {
    if (score >= 75) {
      return this.pickFresh([
        `Crushing it on ${exercise}! Set ${set} of ${totalSets}. Form is excellent — keep this energy!`,
        `You\'re in the zone! ${exercise} form is dialed in. Don\'t let up now!`,
        `Set ${set} of ${totalSets} and your form is still sharp. That takes discipline. Respect!`,
        `This is what consistent training looks like! Great ${exercise} form.`,
        `Love the effort! ${exercise} set ${set} looking professional grade.`,
        `You\'re making this look easy! ${exercise} form on point. Stay locked in!`,
        `Set ${set}, still going strong. That core is tight, form is clean. Beautiful!`,
        `THIS is why you train! Perfect ${exercise} form. You should be proud right now.`,
      ]);
    }
    return this.pickFresh([
      `Keep working on that ${exercise}! Set ${set} of ${totalSets}. Every rep is a chance to improve.`,
      `Stay with it! ${exercise} isn\'t easy, but that\'s why we\'re here. Push through!`,
      `Set ${set} of ${totalSets}. Focus on clean reps, not fast reps. Quality matters.`,
      `Don\'t get discouraged! Form takes practice. Stay focused on ${exercise}.`,
      `You showed up today. That\'s already a win. Now let\'s make these ${exercise} reps count.`,
      `I know it\'s tough. ${exercise} challenges everyone. Keep fighting through it!`,
      `Set ${set}, let\'s go! Think about the muscles working. Feel each ${exercise} rep.`,
      `Nobody said ${exercise} was easy! But you\'re HERE doing it. That\'s what matters.`,
    ]);
  }
}
