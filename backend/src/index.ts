/**
 * Backend entry point — Express server + WebSocket.
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { prisma } from './models/index';
import { sessionsRouter } from './routes/sessions';
import { eventsRouter, registerCoachEngine, unregisterCoachEngine } from './routes/events';
import { handleVoiceConnection } from './routes/voice';
import { CoachEngine } from './services/coachEngine';
import { getExerciseById } from './logic/exerciseDefinitions';

const PORT = parseInt(process.env.PORT || '4000', 10);

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-gym-trainer', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────
app.use('/api', sessionsRouter);
app.use('/api', eventsRouter);

// ── Start coaching for a session ──────────────────────────
app.post('/api/coaching/start', async (req, res) => {
  try {
    const { sessionId, exerciseId, userId } = req.body;

    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      res.status(400).json({ error: `Unknown exercise: ${exerciseId}` });
      return;
    }

    // Look up user goals if provided
    let userGoals: string | undefined;
    let userExperience: 'beginner' | 'intermediate' | 'advanced' | undefined;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userGoals = user.goals || undefined;
        userExperience = (user.experience as typeof userExperience) || undefined;
      }
    }

    const engine = new CoachEngine(
      sessionId,
      exercise.name,
      exercise.id,
      exercise.defaultReps,
      exercise.defaultSets,
      userGoals,
      userExperience,
    );

    registerCoachEngine(sessionId, engine);

    const greeting = await engine.generateSessionStart();

    res.json({
      started: true,
      coaching: {
        text: greeting.text,
        audioBase64: greeting.audioBase64,
        trigger: greeting.trigger,
      },
    });
  } catch (err) {
    console.error('[Server] coaching start error:', err);
    res.status(500).json({ error: 'Failed to start coaching' });
  }
});

// ── Stop coaching for a session ───────────────────────────
app.post('/api/coaching/stop', async (req, res) => {
  try {
    const { sessionId, totalReps, avgFormScore } = req.body;
    const engine = unregisterCoachEngine(sessionId);

    res.json({ stopped: true });
  } catch (err) {
    console.error('[Server] coaching stop error:', err);
    res.status(500).json({ error: 'Failed to stop coaching' });
  }
});

// ── HTTP + WebSocket server ───────────────────────────────
const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);

  if (url.pathname === '/ws/voice') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleVoiceConnection(ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ── Start ─────────────────────────────────────────────────
async function main() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to database');
  } catch (err) {
    console.error('[DB] Connection error:', err);
    console.log('[DB] Running without database — some features may be unavailable');
  }

  server.listen(PORT, () => {
    console.log(`\n  🏋️  AI Gym Trainer Backend`);
    console.log(`  ├─ HTTP:  http://localhost:${PORT}`);
    console.log(`  ├─ WS:    ws://localhost:${PORT}/ws/voice`);
    console.log(`  ├─ Health: http://localhost:${PORT}/health`);
    console.log(`  └─ API:   http://localhost:${PORT}/api\n`);
  });
}

main();
