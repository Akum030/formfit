/**
 * Gemini Client — Wraps the @google/generative-ai SDK for coaching & pose analysis.
 *
 * Two modes:
 *  1. getCoachingFeedback() — Real-time coaching text for TTS
 *  2. analyzePoseWithGemini() — AI-powered form analysis from keypoint data
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// gemini-2.0-flash: cheapest model that still gives excellent results.
// Avoid gemini-2.5-flash — it has "thinking" tokens ($3.50/1M) that explode costs.
// Fallback to gemini-2.0-flash-lite if primary is rate-limited.
const MODEL_CHAIN = (process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash,gemini-2.0-flash-lite').split(',');

// Track which model index is currently working to avoid retrying exhausted ones
let activeModelIdx = 0;
let modelExhaustedUntil: Record<string, number> = {};

function pickModel(): string {
  const now = Date.now();
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const idx = (activeModelIdx + i) % MODEL_CHAIN.length;
    const model = MODEL_CHAIN[idx];
    if (!modelExhaustedUntil[model] || modelExhaustedUntil[model] < now) {
      activeModelIdx = idx;
      return model;
    }
  }
  // All exhausted — return primary and hope it's recovered
  return MODEL_CHAIN[0];
}

function markModelExhausted(model: string, retryAfterSec = 60) {
  modelExhaustedUntil[model] = Date.now() + retryAfterSec * 1000;
  console.log(`[GeminiClient] Model ${model} exhausted, rotating. Next check in ${retryAfterSec}s`);
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') || err.message.includes('Too Many Requests') || err.message.includes('quota');
  }
  return false;
}

function isRotatableError(err: unknown): boolean {
  if (isRateLimitError(err)) return true;
  if (err instanceof Error) {
    // Also rotate on model-not-found errors
    return err.message.includes('404') || err.message.includes('not found') || err.message.includes('not supported');
  }
  return false;
}

// Models are created on-demand per model name (cached)
const modelCache: Record<string, { coach: GenerativeModel; analyzer: GenerativeModel }> = {};

function getModels(modelName: string): { coach: GenerativeModel; analyzer: GenerativeModel } {
  if (modelCache[modelName]) return modelCache[modelName];
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const coach = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: COACH_SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 150, temperature: 0.8 },
  });
  const analyzer = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: POSE_ANALYZER_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.2,
      // Only use JSON mode for models known to support it; prompt handles the rest
      ...(modelName.startsWith('gemini-2.0') ? { responseMimeType: 'application/json' } : {}),
    },
  });
  modelCache[modelName] = { coach, analyzer };
  return modelCache[modelName];
}

const COACH_SYSTEM_PROMPT = `You are an expert, encouraging AI gym coach speaking in real time while the user exercises.

RULES:
- Keep responses to 1-2 SHORT sentences (they will be spoken via TTS).
- Be specific about form issues — name the body part and correction.
- When form is good (score >= 80), give brief varied encouragement.
- When form is bad (score < 50), give ONE clear correction FIRMLY like a strict trainer scolding.
- Count reps naturally: "Nice, that's 5!" or "Great rep number 8!"
- If the user asks a question, answer it briefly and return to coaching.
- Match intensity to the moment: calm at start, energetic mid-set, encouraging at end.
- NEVER repeat the same feedback twice in a row.
- Use varied language and excitement.
- LANGUAGE: Check the [LANG] tag in the state. If "hi" or "hi-IN", ALWAYS respond in Hindi (Devanagari or Romanized Hindi). If "en" or "en-IN", respond in English. If user speaks Hinglish, match their style.
- When the user speaks Hindi, you MUST understand and respond in Hindi.
- When correcting form in Hindi, be direct and firm like a desi gym trainer: "Arre bhai, ghutne andar mat le jao!" or "Seena upar rakh, neeche mat jhuk!"

DO NOT: Give medical advice, use technical jargon, give long explanations, or repeat the exercise name every sentence.`;

const POSE_ANALYZER_SYSTEM_PROMPT = `You are an expert biomechanics analyzer for fitness exercises. You receive keypoint angle data from a pose detection model (MoveNet) and must assess exercise form quality.

For each analysis, you receive:
- Exercise type (squat, pushup, bicep curl, etc.)
- Joint angles computed from detected keypoints
- The movement phase (top, bottom, eccentric, concentric)

You must return a JSON object with:
{
  "score": <number 0-100>,
  "phase": "<detected phase>",
  "issues": ["<specific issue 1>", "<specific issue 2>"],
  "tip": "<one specific actionable tip>",
  "repCompleted": <boolean - true if a full rep was just completed based on phase transition>
}

SCORING GUIDELINES:
- 90-100: Perfect form, all joints properly aligned
- 70-89: Good form with minor issues
- 50-69: Acceptable but needs correction
- 30-49: Poor form, risk of injury
- 0-29: Very poor, stop and correct

EXERCISE-SPECIFIC KNOWLEDGE:
- Squat: Knees track over toes (not caving in), hip-knee angle ~90° at bottom, chest up (torso angle > 45°), full hip extension at top
- Bicep Curl: Upper arm stays stationary (shoulder-elbow angle stable), full range of motion (elbow ~30° at top, ~160° at bottom), no swinging
- Push-up: Body straight line (shoulder-hip-ankle aligned), elbows at ~45° (not flared), chest nearly to ground at bottom
- Lunge: Front knee at 90°, back knee nearly touching ground, torso upright
- Shoulder Press: Full extension overhead, elbows not locked, core engaged (no arching)

Always be precise. If keypoint data is incomplete (missing joints), note it and score conservatively.`;

function getCoachModel(): GenerativeModel {
  return getModels(pickModel()).coach;
}

function getAnalyzerModel(): GenerativeModel {
  return getModels(pickModel()).analyzer;
}

export interface CoachingContext {
  exerciseName: string;
  currentScore: number;
  currentIssues: string[];
  repCount: number;
  setNumber: number;
  targetReps: number;
  targetSets: number;
  recentRepScores: number[];
  userGoals?: string;
  userExperience?: 'beginner' | 'intermediate' | 'advanced';
  userTranscript?: string;
  language?: string;
}

export interface PoseAnalysisInput {
  exerciseName: string;
  exerciseId: string;
  angles: Record<string, number>;    // e.g. { "left_knee": 90, "left_hip": 85 }
  keypointPositions: Record<string, { x: number; y: number; score: number }>;
  currentPhase: string;
  repCount: number;
  previousAnalysis?: PoseAnalysisResult;
}

export interface PoseAnalysisResult {
  score: number;
  phase: string;
  issues: string[];
  tip: string;
  repCompleted: boolean;
}

// Chat session for coaching (keeps conversation context)
let chatSession: ReturnType<GenerativeModel['startChat']> | null = null;
let chatSessionId: string | null = null;
let chatModelName: string | null = null;

function getOrCreateChat(sessionId: string): ReturnType<GenerativeModel['startChat']> {
  const modelName = pickModel();
  if (chatSession && chatSessionId === sessionId && chatModelName === modelName) return chatSession;

  const m = getModels(modelName).coach;
  chatSession = m.startChat({
    history: [
      { role: 'user', parts: [{ text: 'You are my gym coach. Here is my current workout state.' }] },
      { role: 'model', parts: [{ text: "Let's crush this workout! I'm watching your form — let's go!" }] },
    ],
  });
  chatSessionId = sessionId;
  chatModelName = modelName;
  return chatSession;
}

function buildPrompt(ctx: CoachingContext): string {
  const scoreLabel = ctx.currentScore >= 80 ? 'GOOD' : ctx.currentScore >= 50 ? 'NEEDS WORK' : 'POOR';
  const lang = ctx.language || 'hi-IN';

  let prompt = `[LANG] ${lang}\n[STATE] ${ctx.exerciseName} | Score: ${ctx.currentScore}% (${scoreLabel}) | Rep ${ctx.repCount}/${ctx.targetReps} | Set ${ctx.setNumber}/${ctx.targetSets}`;

  if (ctx.recentRepScores.length > 0) {
    prompt += ` | Recent: [${ctx.recentRepScores.join(',')}]`;
  }

  if (ctx.currentIssues.length > 0) {
    prompt += `\n[ISSUES] ${ctx.currentIssues.join('; ')}`;
  }

  if (ctx.userTranscript) {
    prompt += `\n[USER SAID] "${ctx.userTranscript}"`;
  }

  return prompt;
}

export async function getCoachingFeedback(ctx: CoachingContext, sessionId?: string): Promise<string> {
  const sid = sessionId || 'default';
  // Try up to MODEL_CHAIN.length models
  for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
    try {
      const chat = getOrCreateChat(sid);
      const result = await chat.sendMessage(buildPrompt(ctx));
      const text = result.response.text().trim();
      console.log(`[GeminiClient] Coaching (${chatModelName}): "${text}"`);
      return text || "Keep going, you're doing great!";
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GeminiClient] Coaching error (${chatModelName}):`, errMsg);
      if (isRotatableError(err) && chatModelName) {
        markModelExhausted(chatModelName);
        // Don't destroy chat session yet - let getOrCreateChat rebuild it with the next model
        chatModelName = null;
        continue;
      }
      break;
    }
  }
  return getFallbackFeedback(ctx);
}

/**
 * Analyze pose keypoints using Gemini for intelligent form scoring.
 * This is the AI differentiator — goes beyond simple angle thresholds.
 */
export async function analyzePoseWithGemini(input: PoseAnalysisInput): Promise<PoseAnalysisResult | null> {
  const anglesList = Object.entries(input.angles)
    .map(([joint, angle]) => `  ${joint}: ${angle.toFixed(1)}°`)
    .join('\n');

  const prompt = `Analyze this ${input.exerciseName} form:

JOINT ANGLES:
${anglesList}

CURRENT PHASE: ${input.currentPhase}
REP COUNT: ${input.repCount}
${input.previousAnalysis ? `PREVIOUS SCORE: ${input.previousAnalysis.score}` : ''}

Evaluate form quality and return JSON analysis. Respond with ONLY valid JSON, no markdown fences, no explanation.`;

  for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
    const modelName = pickModel();
    try {
      const m = getModels(modelName).analyzer;
      const result = await m.generateContent(prompt);
      let text = result.response.text().trim();

      // Strip markdown code fences if present (```json ... ```)
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      const parsed = JSON.parse(text) as PoseAnalysisResult;
      if (typeof parsed.score !== 'number' || !Array.isArray(parsed.issues)) {
        throw new Error('Invalid response shape');
      }
      parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      console.log(`[GeminiClient] Analysis (${modelName}): score=${parsed.score}`);
      return parsed;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GeminiClient] Analysis error (${modelName}):`, errMsg);
      if (isRotatableError(err)) {
        markModelExhausted(modelName);
        continue;
      }
      break;
    }
  }
  return null;
}

export function resetChatSession() {
  chatSession = null;
  chatSessionId = null;
  chatModelName = null;
}

/** Fallback when Gemini is unavailable — uses varied contextual messages. */
function getFallbackFeedback(ctx: CoachingContext): string {
  const r = Math.random();
  const isHindi = (ctx.language || 'hi-IN').startsWith('hi');

  if (ctx.userTranscript) {
    const t = ctx.userTranscript.toLowerCase();
    // Try to answer common user questions contextually
    if (t.includes('how many') || t.includes('kitne') || t.includes('kitni') || (t.includes('rep') && (t.includes('done') || t.includes('ho')))) {
      return isHindi
        ? `Aapne ${ctx.repCount} reps kiye hain ${ctx.targetReps} mein se. Chal jaari rakho!`
        : `You have done ${ctx.repCount} reps out of ${ctx.targetReps}. Keep pushing!`;
    }
    if (t.includes('score') || t.includes('form') || t.includes('how am i') || t.includes('kaisa') || t.includes('theek')) {
      const label = isHindi
        ? (ctx.currentScore >= 80 ? 'bahut accha' : ctx.currentScore >= 50 ? 'theek hai, thoda sudhaaro' : 'kaam karna padega')
        : (ctx.currentScore >= 80 ? 'great' : ctx.currentScore >= 50 ? 'decent, small fixes needed' : 'needs some work');
      return isHindi
        ? `Form ${label} hai, ${ctx.currentScore}%. ${ctx.currentIssues.length > 0 ? 'Dhyan do: ' + ctx.currentIssues[0] : 'Aise hi karo!'}`
        : `Your form is ${label} at ${ctx.currentScore}%. ${ctx.currentIssues.length > 0 ? 'Focus on: ' + ctx.currentIssues[0] : 'Keep it up!'}`;
    }
    if (t.includes('what') || t.includes('wrong') || t.includes('fix') || t.includes('improve') || t.includes('kya') || t.includes('galat') || t.includes('sudhar')) {
      return ctx.currentIssues.length > 0
        ? (isHindi ? `Yeh fix karo: ${ctx.currentIssues[0]}. Tum kar sakte ho!` : `Main thing to fix: ${ctx.currentIssues[0]}. You got this!`)
        : (isHindi ? 'Abhi form acchi lag rahi hai! Aise hi jaari rakho!' : 'Your form looks solid right now! Keep that up!');
    }
    if (t.includes('set') || t.includes('how many set')) {
      return isHindi
        ? `Aap set ${ctx.setNumber} pe ho, total ${ctx.targetSets}. ${ctx.targetSets - ctx.setNumber > 0 ? (ctx.targetSets - ctx.setNumber) + ' set aur baki!' : 'Last set hai, finish karo!'}`
        : `You are on set ${ctx.setNumber} of ${ctx.targetSets}. ${ctx.targetSets - ctx.setNumber > 0 ? (ctx.targetSets - ctx.setNumber) + ' sets to go!' : 'This is your last set, finish strong!'}`;
    }
    if (t.includes('rest') || t.includes('break') || t.includes('tired') || t.includes('thak') || t.includes('aaraam')) {
      return isHindi ? 'Thoda rest le lo agar zarurat hai. Phir wapas strong aao!' : 'Take a quick breather if you need it. Come back strong for the next rep!';
    }
    if (t.includes('hello') || t.includes('hi') || t.includes('hey') || t.includes('namaste') || t.includes('bhai')) {
      return isHindi
        ? `Hey! Main tumhara coach hoon. Tum ${ctx.exerciseName} kar rahe ho. Chal shuru karte hain!`
        : `Hey! I am your coach. You are doing ${ctx.exerciseName}. Let us crush it!`;
    }
    // Generic responses
    const hindiResponses = [
      `Sun raha hoon! ${ctx.exerciseName} accha chal raha hai. ${ctx.repCount} reps ho gaye!`,
      `Haan bhai! Score ${ctx.currentScore}% hai abhi. ${ctx.currentIssues.length > 0 ? ctx.currentIssues[0] : 'Looking good!'}`,
      `Bilkul! ${ctx.exerciseName} form pe dhyan do. ${ctx.targetReps - ctx.repCount} reps aur baki!`,
      `Saath mein hoon! Rep ${ctx.repCount} of ${ctx.targetReps}, set ${ctx.setNumber}. Jaari rakho!`,
      `Momentum banaye rakho! ${ctx.exerciseName} ka score ${ctx.currentScore}% hai.`,
      `Haan! ${ctx.repCount > 0 ? ctx.repCount + ' reps ho chuke.' : 'Shuru karte hain!'} Controlled movement pe focus karo.`,
    ];
    const enResponses = [
      `I hear you! You are doing great on ${ctx.exerciseName}. ${ctx.repCount} reps so far!`,
      `Got it! Score is ${ctx.currentScore}% right now. ${ctx.currentIssues.length > 0 ? ctx.currentIssues[0] : 'Looking good!'}`,
      `Sure thing! Keep focusing on your ${ctx.exerciseName} form. ${ctx.targetReps - ctx.repCount} reps to go!`,
      `Right here with you! Rep ${ctx.repCount} of ${ctx.targetReps} on set ${ctx.setNumber}. Keep going!`,
      `Let us keep the momentum! Your ${ctx.exerciseName} is at ${ctx.currentScore}% form score.`,
      `Absolutely! ${ctx.repCount > 0 ? 'Already ' + ctx.repCount + ' reps in.' : 'Let us get started!'} Focus on controlled movement.`,
    ];
    const pool = isHindi ? hindiResponses : enResponses;
    return pool[Math.floor(r * pool.length)];
  }
  if (ctx.currentScore >= 80) {
    const hindiPool = [
      'Shaandaar form! Aise hi karo!',
      'Bahut badhiya! Ekdam strong!',
      'Excellent! Form maintain karo!',
      'Kya baat hai! Kamaal kar rahe ho!',
      `Zabardast rep ${ctx.repCount}! Energy banaye rakho!`,
      'Mast form hai! Power through!',
      'Ek aur aise hi aur! Solid!',
      'Textbook form! Jaari rakho!',
    ];
    const enPool = [
      'Perfect form! Keep it up!',
      "That's it! Really strong!",
      'Excellent! Maintain that form!',
      "You're nailing it!",
      `Great rep ${ctx.repCount}! Keep that energy!`,
      'Beautiful form! Power through!',
      'Looking solid! One more just like that!',
      'Textbook form right there! Keep going!',
    ];
    const pool = isHindi ? hindiPool : enPool;
    return pool[Math.floor(r * pool.length)];
  }
  if (ctx.currentScore >= 50) {
    if (ctx.currentIssues.length > 0) {
      return isHindi
        ? `Form pe dhyan do — ${ctx.currentIssues[0]}`
        : `Watch your form — ${ctx.currentIssues[0]}`;
    }
    const hindiPool = [
      'Accha effort hai, form thoda tight karo.',
      'Almost theek hai! Chota sa adjustment chahiye.',
      'Push karo lekin controlled rakho movement.',
    ];
    const enPool = [
      'Good effort, tighten up your form a bit.',
      'Almost there with the form! Small adjustment needed.',
      'Keep pushing but focus on controlled movements.',
    ];
    const pool = isHindi ? hindiPool : enPool;
    return pool[Math.floor(r * pool.length)];
  }
  if (ctx.currentIssues.length > 0) {
    return isHindi
      ? `Dhyan do: ${ctx.currentIssues[0]}`
      : `Focus on this: ${ctx.currentIssues[0]}`;
  }
  return isHindi
    ? 'Dheere karo aur form pe dhyan do. Quality pehle, speed baad mein!'
    : 'Slow down and focus on your form. Quality over speed!';
}
