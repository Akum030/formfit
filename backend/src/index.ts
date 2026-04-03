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
import { eventsRouter, registerCoachEngine, unregisterCoachEngine, getCoachEngine } from './routes/events';
import { foodRouter } from './routes/food';
import { dietRouter } from './routes/diet';
import { handleVoiceConnection } from './routes/voice';
import { CoachEngine } from './services/coachEngine';
import { getExerciseById } from './logic/exerciseDefinitions';

const PORT = parseInt(process.env.PORT || '4000', 10);

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ── Health check ──────────────────────────────────────────
// Core features (pose detection, food analysis, diet planning, coaching) work
// fully offline. AI APIs are optional enhancements.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-gym-trainer',
    timestamp: new Date().toISOString(),
    mode: 'offline-capable',
    features: {
      poseDetection: 'local (MoveNet)',
      foodAnalysis: 'local (Indian food database)',
      dietPlanning: 'local (BMR/TDEE algorithm)',
      voiceCoaching: 'browser (Web Speech API)',
      coachingText: 'local (template-based with optional AI enhancement)',
    },
  });
});

// ── API Routes ────────────────────────────────────────────
app.use('/api', sessionsRouter);
app.use('/api', eventsRouter);
app.use('/api', foodRouter);
app.use('/api', dietRouter);

// ── Start coaching for a session ──────────────────────────
app.post('/api/coaching/start', async (req, res) => {
  try {
    const { sessionId, exerciseId, userId, language } = req.body;

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
      language || 'hi-IN',
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
    unregisterCoachEngine(sessionId);

    res.json({ stopped: true });
  } catch (err) {
    console.error('[Server] coaching stop error:', err);
    res.status(500).json({ error: 'Failed to stop coaching' });
  }
});

// ── Respond to user speech (REST alternative to voice WebSocket) ──
// Called by frontend when browser SpeechRecognition captures user text
app.post('/api/coaching/respond', async (req, res) => {
  try {
    const { sessionId, userText, language } = req.body;

    if (!sessionId || !userText) {
      res.status(400).json({ error: 'sessionId and userText are required' });
      return;
    }

    const engine = getCoachEngine(sessionId);
    if (!engine) {
      // No active coaching session — return a generic encouragement
      res.json({
        text: language?.startsWith('hi') ? 'बहुत अच्छे! मेहनत जारी रखो!' : 'Great job! Keep going!',
        trigger: 'user_speech',
      });
      return;
    }

    const result = await engine.handleUserSpeech(userText);
    if (result) {
      res.json({
        text: result.text,
        trigger: result.trigger || 'user_speech',
      });
    } else {
      res.json({
        text: language?.startsWith('hi') ? 'बहुत अच्छे! मेहनत जारी रखो!' : 'Keep going! You are doing great!',
        trigger: 'user_speech',
      });
    }
  } catch (err) {
    console.error('[Server] coaching respond error:', err);
    // Never 500 — return a fallback text response
    res.json({
      text: 'Keep pushing! You are doing great!',
      trigger: 'user_speech',
    });
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

  // API key info — optional enhancements
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const sarvamKey = process.env.SARVAM_API_KEY || '';
  const isPlaceholder = (key: string) =>
    !key || key.includes('your-') || key.includes('placeholder') || key.length < 10;

  console.log('  📦 Core features work 100% offline (no API keys required)');
  if (!isPlaceholder(geminiKey)) {
    console.log('  ✅ Gemini API key configured — AI coaching enhancement active');
  }
  if (!isPlaceholder(sarvamKey)) {
    console.log('  ✅ Sarvam API key configured — server-side TTS/STT active');
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
