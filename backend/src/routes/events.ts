/**
 * Events Routes — Receives real-time pose events from the frontend.
 *
 * POST /api/events/pose — Frame-level pose data + scores
 * POST /api/events/rep  — Completed rep notification
 *
 * These events feed the CoachEngine for coaching decisions.
 */

import { Router, type Request, type Response } from 'express';
import { type CoachEngine } from '../services/coachEngine';
import { analyzePoseWithGemini, type PoseAnalysisInput } from '../services/geminiClient';
import { sendCoachingToVoice } from './voice';

// Rate limit Gemini pose analysis (expensive — max every 3 seconds)
const lastAnalysisTime = new Map<string, number>();
const ANALYSIS_INTERVAL_MS = 3000;

// CoachEngine instances keyed by sessionId
const activeEngines = new Map<string, CoachEngine>();

export function registerCoachEngine(sessionId: string, engine: CoachEngine) {
  activeEngines.set(sessionId, engine);
}

export function unregisterCoachEngine(sessionId: string) {
  const engine = activeEngines.get(sessionId);
  if (engine) {
    engine.cancelPending();
    activeEngines.delete(sessionId);
  }
}

export function getCoachEngine(sessionId: string): CoachEngine | undefined {
  return activeEngines.get(sessionId);
}

export const eventsRouter = Router();

// ── POST /api/events/pose — Live pose event ──────────────
eventsRouter.post('/events/pose', async (req: Request, res: Response) => {
  try {
    const { sessionId, score, issues } = req.body;

    const engine = activeEngines.get(sessionId);
    if (!engine) {
      res.status(404).json({ error: 'No active coaching session' });
      return;
    }

    engine.updateFormScore(score, issues || []);

    // Check for urgent form interruption first — push directly via WebSocket
    const urgent = await engine.checkUrgentFormInterruption();
    if (urgent && urgent.text) {
      sendCoachingToVoice(sessionId, urgent.text, urgent.audioBase64 || '', urgent.trigger);
      res.json({ coaching: { text: urgent.text, audioBase64: urgent.audioBase64, trigger: urgent.trigger } });
      return;
    }

    // Check if coaching should trigger (form issues first, then periodic motivation)
    let coaching = await engine.checkFormCoaching();
    if (!coaching) {
      coaching = await engine.checkMotivationCoaching();
    }

    // Also push coaching through WebSocket for voice playback
    if (coaching && coaching.text) {
      sendCoachingToVoice(sessionId, coaching.text, coaching.audioBase64 || '', coaching.trigger);
    }

    res.json({
      coaching: coaching
        ? { text: coaching.text, audioBase64: coaching.audioBase64, trigger: coaching.trigger }
        : null,
    });
  } catch (err) {
    console.error('[Events] pose error:', err);
    res.status(500).json({ error: 'Failed to process pose event' });
  }
});

// ── POST /api/events/rep — Rep completed event ───────────
eventsRouter.post('/events/rep', async (req: Request, res: Response) => {
  try {
    const { sessionId, repCount, repScore } = req.body;

    const engine = activeEngines.get(sessionId);
    if (!engine) {
      res.status(404).json({ error: 'No active coaching session' });
      return;
    }

    engine.updateRepCount(repCount, repScore);

    const coaching = await engine.checkRepCoaching();

    res.json({
      coaching: coaching
        ? { text: coaching.text, audioBase64: coaching.audioBase64, trigger: coaching.trigger }
        : null,
    });
  } catch (err) {
    console.error('[Events] rep error:', err);
    res.status(500).json({ error: 'Failed to process rep event' });
  }
});

// ── POST /api/events/set-complete — Set completed ────────
eventsRouter.post('/events/set-complete', async (req: Request, res: Response) => {
  try {
    const { sessionId, setNumber } = req.body;

    const engine = activeEngines.get(sessionId);
    if (!engine) {
      res.status(404).json({ error: 'No active coaching session' });
      return;
    }

    engine.updateSet(setNumber + 1);
    const coaching = await engine.generateSetTransition();

    res.json({
      coaching: { text: coaching.text, audioBase64: coaching.audioBase64, trigger: coaching.trigger },
    });
  } catch (err) {
    console.error('[Events] set-complete error:', err);
    res.status(500).json({ error: 'Failed to process set complete event' });
  }
});

// ── POST /api/events/analyze — Gemini AI pose analysis ───
eventsRouter.post('/events/analyze', async (req: Request, res: Response) => {
  try {
    const { sessionId, exerciseName, exerciseId, angles, keypointPositions, currentPhase, repCount } = req.body;

    // Rate limit per session
    const now = Date.now();
    const lastTime = lastAnalysisTime.get(sessionId) || 0;
    if (now - lastTime < ANALYSIS_INTERVAL_MS) {
      res.json({ analysis: null, throttled: true });
      return;
    }
    lastAnalysisTime.set(sessionId, now);

    const input: PoseAnalysisInput = {
      exerciseName,
      exerciseId,
      angles: angles || {},
      keypointPositions: keypointPositions || {},
      currentPhase: currentPhase || 'top',
      repCount: repCount || 0,
    };

    const analysis = await analyzePoseWithGemini(input);

    // If we got a Gemini analysis, also update the coach engine
    if (analysis) {
      const engine = activeEngines.get(sessionId);
      if (engine) {
        engine.updateFormScore(analysis.score, analysis.issues);
      }
    }

    res.json({ analysis });
  } catch (err) {
    console.error('[Events] analyze error:', err);
    res.json({ analysis: null, error: 'Analysis failed' });
  }
});
