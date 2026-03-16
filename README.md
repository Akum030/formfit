# RepSensei 🥋 — AI Gym Sensei

**Live Agent** for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)

RepSensei is a **real-time AI personal trainer** that watches your workout through the webcam, scores your form using pose detection, and coaches you in **Hindi or English** using a live voice agent that **interrupts mid-exercise** when your form breaks down — just like a real trainer.

🌐 **Live Demo:** https://fitsenseai.aidhunik.com  
📦 **GitHub:** https://github.com/Akum030/formfit

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Vite)                     │
│                                                                    │
│  ┌──────────┐   ┌───────────────────┐   ┌──────────────────────┐ │
│  │  Webcam  │──▶│  MoveNet Thunder  │──▶│  Angle-Based Form    │ │
│  │  Camera  │   │  (TensorFlow.js)  │   │  Scoring Engine      │ │
│  │  640×480 │   │  17 Keypoints     │   │  Phase Detection     │ │
│  └──────────┘   │  15+ FPS          │   │  Rep Counter         │ │
│                 └───────────────────┘   └──────────┬───────────┘ │
│                                                     │ REST Events  │
│  ┌──────────────────────────────┐     ┌────────────▼───────────┐ │
│  │  Mic (MediaRecorder)         │◀────│  Canvas Overlay        │ │
│  │  WebSocket Audio Stream      │────▶│  Skeleton + Score HUD  │ │
│  │  Speaker (AudioContext)      │     │  Rep Counter + Phase   │ │
│  └──────────────────────────────┘     └────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────────┘
                             │ REST + WebSocket (ws://)
┌────────────────────────────▼─────────────────────────────────────┐
│                  BACKEND (Node.js + Express + TypeScript)          │
│                                                                    │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │  CoachEngine     │   │  Gemini 2.5 Flash│   │  Sarvam AI   │  │
│  │  ─ Rate limiter  │──▶│  ─ Coaching text │   │  ─ STT hi-IN │  │
│  │  ─ Lang toggle   │   │  ─ Form analysis │   │  ─ TTS hi-IN │  │
│  │  ─ URGENT intr.  │   │  ─ Fallback chain│   │  ─ bulbul:v2 │  │
│  └──────────────────┘   └──────────────────┘   └──────────────┘  │
│                                                                    │
│  ┌──────────────────┐   ┌──────────────────────────────────────┐  │
│  │  /ws/voice       │   │  Prisma ORM + SQLite                 │  │
│  │  Audio ◀──▶ STT  │   │  Users / Sessions / SetLogs / Reps   │  │
│  │  TTS ──▶ Audio   │   └──────────────────────────────────────┘  │
│  └──────────────────┘                                              │
└──────────────────────────────────────────────────────────────────┘
                             │ Reverse Proxy
┌────────────────────────────▼─────────────────────────────────────┐
│           Nginx  ─  fitsenseai.aidhunik.com  (HTTPS/WSS)          │
└──────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Pose Detection | MoveNet Thunder (TensorFlow.js) — runs in-browser |
| Form Scoring | Custom angle-constraint engine (per-phase, per-joint) |
| AI Coach | **Gemini 2.5 Flash** (Google AI SDK) with multi-model fallback chain |
| Voice STT | **Sarvam AI** saarika:v2.5 — Hindi (hi-IN) default |
| Voice TTS | **Sarvam AI** bulbul:v2, speaker anushka — Hindi default |
| Real-time Coaching | WebSocket duplex + CoachEngine with urgent interruption |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express + TypeScript + WebSocket (ws) |
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Deployment | Docker + docker-compose + Nginx reverse proxy |
| Domain | https://fitsenseai.aidhunik.com |

## Quick Start — Reproducible Testing Instructions

### Prerequisites

- Node.js 20+
- npm 9+
- A webcam and microphone
- API Keys: `GEMINI_API_KEY` (required), `SARVAM_API_KEY` (for voice; text fallback otherwise)

### 1. Clone & Install

```bash
git clone https://github.com/Akum030/formfit.git
cd formfit

# Backend
cd backend
cp .env.example .env
# Add your GEMINI_API_KEY and optionally SARVAM_API_KEY to .env
npm install
npx prisma db push
npx prisma generate

# Frontend
cd ../frontend
cp .env.example .env
npm install
```

### 2. Run Development

```bash
# Terminal 1 — Backend (port 4000)
cd backend
npx tsx src/index.ts

# Terminal 2 — Frontend (port 5174)
cd frontend
npm run dev
```

Open http://localhost:5174 in your browser.

### 3. Run with Docker (Production)

```bash
# Copy and fill in your keys
cp backend/.env.example backend/.env
# Edit backend/.env with GEMINI_API_KEY and SARVAM_API_KEY

docker compose up -d --build

# Verify
curl http://localhost:4000/health
# Expected: {"status":"ok","service":"ai-gym-trainer"}
```

### 4. Run E2E Tests

> Requires both servers running (step 2 or 3 above)

```bash
# From project root
npx playwright test

# Run with browser visible
npx playwright test --headed
```

12 tests covering: homepage, exercise selection, backend API, session flow, coaching, rep events, history page.

### 5. Test the Voice Agent

1. Open http://localhost:5174
2. **Allow camera and microphone** access
3. Select any exercise (e.g., Squat)
4. Click **Start Workout**
5. Speak in Hindi: _"bhai meri form kaisi hai?"_ — coach responds in Hindi
6. Or click the **🇬🇧 English** toggle in the controls panel to switch to English
7. Do a squat with bad form (knees caving in) — coach **interrupts mid-rep** with a correction

## Exercises Supported (22 Total)

### Bodyweight / Home Workouts

| Exercise | Category | Reps × Sets |
|----------|----------|-------------|
| Squat | Legs | 12 × 3 |
| Push-up | Chest | 10 × 3 |
| Lunge | Legs | 10 × 3 |
| Jumping Jacks | Cardio | 20 × 3 |
| High Knees | Cardio | 20 × 3 |
| Glute Bridge | Glutes | 15 × 3 |
| Calf Raise | Legs | 15 × 3 |
| Tricep Dip | Arms | 10 × 3 |
| Wall Sit | Legs | hold × 3 |
| Sumo Squat | Legs | 15 × 3 |
| Standing Crunch | Core | 15 × 3 |
| Standing Leg Raise | Core | 12 × 3 |

### Dumbbell / Gym

| Exercise | Category | Reps × Sets |
|----------|----------|-------------|
| Bicep Curl | Arms | 12 × 3 |
| Shoulder Press | Shoulders | 10 × 3 |
| Lateral Raise | Shoulders | 12 × 3 |
| Front Raise | Shoulders | 12 × 3 |
| Dumbbell Row | Back | 12 × 3 |
| Hammer Curl | Arms | 12 × 3 |
| Deadlift | Back | 10 × 3 |
| Goblet Squat | Legs | 12 × 3 |
| Overhead Tricep Extension | Arms | 12 × 3 |

## Form Scoring

Each frame is scored 0-100% based on angle constraints:

- **≥ 80%** 🟢 Green — Great form
- **50-79%** 🟡 Yellow — Needs adjustment  
- **< 50%** 🔴 Red — Fix form before continuing

Angles are calculated at joint vertices (e.g., angle at knee = hip→knee→ankle) and compared against exercise-specific constraint ranges per movement phase (top/bottom/eccentric/concentric).

## Voice Coaching

With a Sarvam AI API key, the coach:
- **Listens continuously** (no push-to-talk)
- **Responds to questions** ("How's my form?", "How many reps left?")
- **Proactive feedback** when form drops below threshold
- **Rep callouts** after each completed rep
- **Interruptible** — speaking while coach talks stops playback

Without Sarvam API key, coaching is text-only using Gemini.

## Environment Variables

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 4000 | Server port |
| `DATABASE_URL` | No | file:./dev.db | Prisma database URL |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key |
| `GEMINI_MODEL_NAME` | No | gemini-2.0-flash | Model name |
| `SARVAM_API_KEY` | No | — | Sarvam AI key for voice |
| `SARVAM_STT_ENDPOINT` | No | (default) | STT API endpoint |
| `SARVAM_TTS_ENDPOINT` | No | (default) | TTS API endpoint |

### Frontend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | (proxy) | Backend URL for API calls |

## Docker Deployment

```bash
# Set environment
export GEMINI_API_KEY=your-key-here

# Build and run
docker compose up -d --build

# Check health
curl http://localhost:4000/health
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/exercises` | List exercises |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions` | List sessions (history) |
| GET | `/api/sessions/:id` | Session detail |
| PATCH | `/api/sessions/:id/end` | End session |
| POST | `/api/sessions/:id/sets` | Log completed set |
| POST | `/api/events/pose` | Live pose event |
| POST | `/api/events/rep` | Rep completed event |
| POST | `/api/coaching/start` | Start coaching engine |
| POST | `/api/coaching/stop` | Stop coaching engine |
| WS | `/ws/voice` | Duplex voice streaming |

## Project Structure

```
ai-gym-trainer/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express + WS server
│   │   ├── models/index.ts       # Prisma client
│   │   ├── logic/
│   │   │   ├── exerciseDefinitions.ts  # Angle constraints
│   │   │   ├── formScoring.ts          # Score engine
│   │   │   └── exerciseClassifier.ts   # Exercise detection
│   │   ├── services/
│   │   │   ├── geminiClient.ts   # Gemini AI coaching
│   │   │   ├── sarvamClient.ts   # Sarvam STT/TTS
│   │   │   └── coachEngine.ts    # Coaching orchestrator
│   │   └── routes/
│   │       ├── sessions.ts       # Session CRUD
│   │       ├── events.ts         # Pose/rep events
│   │       └── voice.ts          # WebSocket voice
│   └── prisma/schema.prisma
├── frontend/
│   ├── src/
│   │   ├── main.tsx / App.tsx
│   │   ├── components/
│   │   │   ├── CameraView.tsx     # Webcam + canvas
│   │   │   ├── OverlaySkeleton.tsx # Pose overlay
│   │   │   ├── SessionControls.tsx # Controls panel
│   │   │   └── HistoryView.tsx    # Session history
│   │   ├── hooks/
│   │   │   ├── useMoveNet.ts     # TF.js pose detection
│   │   │   ├── useFormScoring.ts # Real-time scoring
│   │   │   └── useVoiceAgent.ts  # Voice streaming
│   │   ├── utils/pose.ts         # Angle math
│   │   ├── data/exercises.ts     # Exercise definitions
│   │   └── types/index.ts        # TypeScript types
│   └── index.html
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── README.md
```

## License

MIT
