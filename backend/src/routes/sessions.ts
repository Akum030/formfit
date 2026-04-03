/**
 * Sessions Routes — CRUD for workout sessions + set/rep logging.
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../models/index';
import { EXERCISES, getExerciseById } from '../logic/exerciseDefinitions';

export const sessionsRouter = Router();

// ── GET /api/exercises — List available exercises ─────────
sessionsRouter.get('/exercises', (_req: Request, res: Response) => {
  const exercises = EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    defaultSets: e.defaultSets,
    defaultReps: e.defaultReps,
    restSeconds: e.restSeconds,
  }));
  res.json(exercises);
});

// ── POST /api/sessions — Start a new session ─────────────
sessionsRouter.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { exerciseId, userId } = req.body;

    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      res.status(400).json({ error: `Unknown exercise: ${exerciseId}` });
      return;
    }

    // Validate userId exists in DB if provided — prevents FK constraint error
    let validUserId: string | undefined;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (user) {
        validUserId = userId;
      }
      // Silently ignore invalid userId — session proceeds without user link
    }

    const session = await prisma.session.create({
      data: {
        exerciseId,
        status: 'active',
        totalSets: exercise.defaultSets,
        targetReps: exercise.defaultReps,
        ...(validUserId ? { userId: validUserId } : {}),
      },
    });

    res.status(201).json({
      sessionId: session.id,
      exerciseId: session.exerciseId,
      exercise: {
        name: exercise.name,
        defaultSets: exercise.defaultSets,
        defaultReps: exercise.defaultReps,
        restSeconds: exercise.restSeconds,
      },
    });
  } catch (err) {
    console.error('[Sessions] create error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ── GET /api/sessions/:id — Get session details ──────────
sessionsRouter.get('/sessions/:id', async (req: Request<{id: string}>, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        setLogs: {
          include: { repLogs: true },
          orderBy: { setNumber: 'asc' },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (err) {
    console.error('[Sessions] get error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// ── PATCH /api/sessions/:id/end — End a session ──────────
sessionsRouter.patch('/sessions/:id/end', async (req: Request<{id: string}>, res: Response) => {
  try {
    const { avgFormScore, totalReps, aiSummary } = req.body;

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        endedAt: new Date(),
        ...(avgFormScore !== undefined && { avgFormScore }),
        ...(totalReps !== undefined && { totalReps }),
        ...(aiSummary !== undefined && { aiSummary }),
      },
    });

    res.json(session);
  } catch (err) {
    console.error('[Sessions] end error:', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// ── POST /api/sessions/:id/sets — Log a completed set ────
sessionsRouter.post('/sessions/:id/sets', async (req: Request<{id: string}>, res: Response) => {
  try {
    const { setNumber, repsCount, avgFormScore, duration } = req.body;

    const setLog = await prisma.setLog.create({
      data: {
        sessionId: req.params.id,
        setNumber,
        repsCount,
        avgFormScore: avgFormScore ?? null,
        duration: duration ?? null,
      },
    });

    res.status(201).json(setLog);
  } catch (err) {
    console.error('[Sessions] create set error:', err);
    res.status(500).json({ error: 'Failed to log set' });
  }
});

// ── POST /api/sessions/:id/sets/:setId/reps — Log a rep ──
sessionsRouter.post('/sessions/:id/sets/:setId/reps', async (req: Request<{id: string; setId: string}>, res: Response) => {
  try {
    const { repNumber, formScore, issues } = req.body;

    const repLog = await prisma.repLog.create({
      data: {
        setLogId: req.params.setId,
        repNumber,
        formScore: formScore ?? 0,
        issues: JSON.stringify(issues ?? []),
      },
    });

    res.status(201).json(repLog);
  } catch (err) {
    console.error('[Sessions] create rep error:', err);
    res.status(500).json({ error: 'Failed to log rep' });
  }
});

// ── GET /api/sessions — List sessions (history) ──────────
sessionsRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 20, 100);
    const userId = req.query.userId as string | undefined;
    const sessions = await prisma.session.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        setLogs: {
          select: { id: true, setNumber: true, repsCount: true, avgFormScore: true },
          orderBy: { setNumber: 'asc' },
        },
      },
    });

    res.json(sessions);
  } catch (err) {
    console.error('[Sessions] list error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ═══════════════════════════════════════════════════════════
// User Management + Calendar
// ═══════════════════════════════════════════════════════════

// ── POST /api/users — Create a new user ───────────────────
sessionsRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const { name, goals, experience } = req.body;
    const user = await prisma.user.create({
      data: {
        name: (typeof name === 'string' ? name.trim() : '') || 'Athlete',
        goals: typeof goals === 'string' ? goals : undefined,
        experience: typeof experience === 'string' ? experience : 'beginner',
      },
    });
    res.status(201).json(user);
  } catch (err) {
    console.error('[Users] create error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── GET /api/users/:id — Get user profile ─────────────────
sessionsRouter.get('/users/:id', async (req: Request<{id: string}>, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error('[Users] get error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ── PATCH /api/users/:id — Update user profile ───────────
sessionsRouter.patch('/users/:id', async (req: Request<{id: string}>, res: Response) => {
  try {
    const { name, goals, experience } = req.body;
    const data: Record<string, string> = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof goals === 'string') data.goals = goals;
    if (typeof experience === 'string') data.experience = experience;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    res.json(user);
  } catch (err) {
    console.error('[Users] update error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── GET /api/users/:id/stats — Aggregate stats ───────────
sessionsRouter.get('/users/:id/stats', async (req: Request<{id: string}>, res: Response) => {
  try {
    const userId = req.params.id;
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });

    const totalSessions = sessions.length;
    const totalReps = sessions.reduce((sum, s) => sum + (s.totalReps || 0), 0);
    const scored = sessions.filter(s => s.avgFormScore != null && s.avgFormScore > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((sum, s) => sum + (s.avgFormScore || 0), 0) / scored.length)
      : 0;

    // Calculate streak (consecutive days with workouts from today backwards)
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateset = new Set(sessions.map(s => s.startedAt.toISOString().split('T')[0]));
    for (let d = new Date(today); ; d.setDate(d.getDate() - 1)) {
      const key = d.toISOString().split('T')[0];
      if (dateset.has(key)) {
        streak++;
      } else if (d.getTime() < today.getTime()) {
        break;
      }
    }

    res.json({ totalSessions, totalReps, avgScore, streak });
  } catch (err) {
    console.error('[Users] stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ── GET /api/users/:id/calendar — Monthly workout heatmap ─
sessionsRouter.get('/users/:id/calendar', async (req: Request<{id: string}>, res: Response) => {
  try {
    const userId = req.params.id;
    const now = new Date();
    const month = parseInt(String(req.query.month)) || (now.getMonth() + 1);
    const year = parseInt(String(req.query.year)) || now.getFullYear();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        startedAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    // Group by date
    const dayMap = new Map<string, { sessions: number; totalReps: number; scores: number[] }>();
    sessions.forEach(s => {
      const dateStr = s.startedAt.toISOString().split('T')[0];
      const existing = dayMap.get(dateStr) || { sessions: 0, totalReps: 0, scores: [] };
      existing.sessions++;
      existing.totalReps += s.totalReps || 0;
      if (s.avgFormScore != null) existing.scores.push(s.avgFormScore);
      dayMap.set(dateStr, existing);
    });

    const days = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      sessions: data.sessions,
      totalReps: data.totalReps,
      avgScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    }));

    res.json({ days });
  } catch (err) {
    console.error('[Users] calendar error:', err);
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});
