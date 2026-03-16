# AI Gym Trainer 🏋️

Real-time AI-powered gym coach using **MoveNet** pose detection, **Gemini** coaching intelligence, and **Sarvam AI** continuous duplex voice.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐     │
│  │ Webcam   │→ │ MoveNet   │→ │ Form Scoring     │     │
│  │ Camera   │  │ TF.js     │  │ Angle + Phase    │     │
│  └──────────┘  └───────────┘  └──────┬───────────┘     │
│                                       │                  │
│  ┌──────────┐                  ┌──────▼───────────┐     │
│  │ Mic +    │◀──── WebSocket ──│ Canvas Overlay    │     │
│  │ Speaker  │────► Audio ────►│ Skeleton + Score  │     │
│  └──────────┘                  └──────────────────┘     │
└──────────────────────────┬──────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼──────────────────────────────┐
│                     BACKEND (Node.js)                    │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────┐      │
│  │ Coach Engine │  │ Gemini   │  │ Sarvam AI    │      │
│  │ Rate-limit   │→ │ Flash    │  │ STT / TTS    │      │
│  │ + Trigger    │  │ Coaching │  │ Duplex Voice │      │
│  └──────────────┘  └──────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────────────────────┐     │
│  │ Sessions API │  │ Prisma + SQLite/PostgreSQL   │     │
│  └──────────────┘  └──────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Pose Detection | MoveNet Thunder (TensorFlow.js) |
| Form Scoring | Custom angle-constraint engine |
| AI Coach | Gemini 2.0 Flash |
| Voice | Sarvam AI (STT: saarika:v2 / TTS: bulbul:v1) |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express + TypeScript + WebSocket |
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Deployment | Docker + docker-compose |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### 1. Clone & Install

```bash
cd ai-gym-trainer

# Backend
cd backend
cp .env.example .env
# Edit .env with your GEMINI_API_KEY (required) and SARVAM_API_KEY (optional)
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
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Health: http://localhost:4000/health

### 3. Use It

1. **Allow camera & microphone** when prompted
2. **Wait for MoveNet** to load (status indicator turns green)
3. **Select an exercise** from the sidebar
4. **Click "Start Workout"**
5. **Exercise!** — AI scores your form in real-time
6. **Voice coaching** happens automatically (needs Sarvam API key)

## Exercises Supported

| Exercise | Primary Angles | Reps × Sets |
|----------|---------------|-------------|
| Squat | Hip-Knee-Ankle, Torso Lean | 12 × 3 |
| Push-up | Shoulder-Elbow-Wrist, Body Line | 10 × 3 |
| Lunge | Front Knee, Torso, Back Knee | 10 × 3 |
| Bicep Curl | Elbow Angle | 12 × 3 |
| Shoulder Press | Elbow Extension | 10 × 3 |

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
