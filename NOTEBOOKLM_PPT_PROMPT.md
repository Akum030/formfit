# NotebookLM Presentation Prompt — FitSenseAI

Use the following information to create a polished hackathon presentation (12-15 slides) for **FitSenseAI**, an AI gym coach submitted to the **Gemini Live Agent Challenge** on Devpost.

---

## Slide 1 — Title

**FitSenseAI** — Your AI Gym Coach That Sees, Speaks & Corrects in Real-Time

- Tagline: "Like having a personal trainer watching every rep — powered by Gemini"
- Live Demo: https://fitsenseai.aidhunik.com
- GitHub: https://github.com/Akum030/formfit
- Hackathon: Gemini Live Agent Challenge

---

## Slide 2 — The Problem

- 80% of gym-goers perform exercises with incorrect form, risking injury
- Personal trainers cost ₹2,000–₹5,000/session — not affordable for most people
- YouTube tutorials can't give real-time feedback during your actual workout
- Existing fitness apps count reps but **don't analyze form quality**
- No app speaks to you in Hindi while correcting your posture mid-exercise

---

## Slide 3 — Our Solution

FitSenseAI is a **real-time AI personal trainer** that:
1. **Watches** your workout through your webcam using pose detection
2. **Scores** every frame of your form (0-100%) using angle-based constraints
3. **Speaks** corrections and encouragement in **Hindi or English** using a live voice agent
4. **Interrupts** you mid-rep when your form drops below 30% — just like a real trainer shouting "Ruko! Form fix karo!"
5. Tracks reps, sets, and rest timers automatically

---

## Slide 4 — Live Demo Flow (for video)

1. Open FitSenseAI → Choose language (Hindi 🇮🇳 / English 🇬🇧)
2. Select exercise (e.g., Squat) → Click "Start Workout"
3. Camera activates, MoveNet detects skeleton in real-time
4. Do squats — each rep counted, form scored with color overlay (🟢🟡🔴)
5. Intentionally do bad form → **Coach interrupts**: "Bhai, ghutne andar mat jaane do!"
6. Ask the coach in Hindi: "Meri form kaisi hai?" → Coach responds with Gemini-powered feedback
7. Complete 12 reps → Set completes automatically → 45-second rest timer with overlay
8. After all sets → Session summary with stats

---

## Slide 5 — Architecture Overview

```
Browser (React + Vite)
├── Webcam 640×480 → MoveNet Thunder (TF.js, 17 keypoints, 15+ FPS)
├── Angle-Based Form Scoring Engine (per-joint, per-phase)
├── Rep Counter + Phase Detection (top/bottom/eccentric/concentric)
├── Mic → WebSocket audio stream → Backend
└── Speaker ← WebSocket TTS audio ← Backend

Backend (Node.js + Express + TypeScript)
├── CoachEngine (rate-limited, multi-trigger coaching)
├── Gemini 2.5 Flash (coaching text, form analysis, fallback chain)
├── Sarvam AI (STT saarika:v2.5 + TTS bulbul:v2, Hindi default)
├── WebSocket /ws/voice (duplex audio streaming)
└── Prisma ORM + SQLite (sessions, sets, reps)

Deployment: Docker + Nginx reverse proxy → fitsenseai.aidhunik.com
```

---

## Slide 6 — How Gemini Powers the Coach

- **Model**: Gemini 2.5 Flash with multi-model fallback chain (2.5 Flash → 2.5 Flash Lite → 2.0 Flash)
- **System Prompt**: Desi gym trainer personality — speaks in user's chosen language, gives 1-2 short actionable sentences
- **Context Window**: Each coaching request includes: exercise name, current score, rep/set progress, detected issues, and what the user said
- **Coaching Triggers**:
  - 🗣️ **User speech** — Answers questions like "How many reps left?" or "Am I doing it right?"
  - 🔴 **Urgent interruption** — Score drops below 30%, Gemini generates immediate correction
  - 📊 **Form coaching** — Periodic form tips based on detected angle issues
  - 💪 **Rep motivation** — Encouragement after every few reps
  - 🔄 **Set transition** — Coaching between sets during rest period
- **TTS-Resilient**: If Sarvam TTS fails, coaching text still reaches the user (no silent failures)

---

## Slide 7 — Sarvam AI Integration (Voice)

- **Speech-to-Text**: Sarvam saarika:v2.5 — Hindi-first STT, processes PCM audio chunks
- **Text-to-Speech**: Sarvam bulbul:v2 with speaker "anushka" — natural Hindi voice
- **Default Language**: Hindi (hi-IN) — switchable to English (en-IN) from home page
- **WebSocket Duplex**: Continuous mic streaming → silence detection → STT → Gemini → TTS → speaker playback
- **Interruptible**: User speaking during coach playback stops audio immediately (amplitude threshold detection)
- **No push-to-talk** — always listening, always ready to respond

---

## Slide 8 — Pose Detection & Form Scoring

- **MoveNet Thunder** (TensorFlow.js) — runs entirely in-browser, no server round-trip
- **17 keypoints** detected per frame at 15+ FPS
- **Angle-based scoring**: Joint angles (e.g., knee angle = hip→knee→ankle) compared against exercise-specific constraints
- **Phase detection**: Each exercise has phases (top, bottom, eccentric, concentric) with different angle requirements
- **Scoring bands**: ≥80% 🟢 Great | 50-79% 🟡 Adjust | <50% 🔴 Fix now
- **Canvas overlay**: Real-time skeleton, score HUD, rep counter drawn on camera feed

---

## Slide 9 — 22 Exercises Supported

**Bodyweight / Home**: Squat, Push-up, Lunge, Jumping Jacks, High Knees, Glute Bridge, Calf Raise, Tricep Dip, Wall Sit, Sumo Squat, Standing Crunch, Standing Leg Raise

**Dumbbell / Gym**: Bicep Curl, Shoulder Press, Lateral Raise, Front Raise, Dumbbell Row, Hammer Curl, Deadlift, Goblet Squat, Overhead Tricep Extension

Each exercise has:
- Custom angle constraints per joint
- Phase-specific scoring rules
- Target reps × sets (e.g., Squat: 12 reps × 3 sets)
- Configurable rest time (30-90 seconds)

---

## Slide 10 — Auto Set Completion & Rest Timer

- When you hit target reps (e.g., 12 for squats), set completes automatically
- **Rest timer overlay** appears on camera: big countdown + "REST" label
- During rest: coach gives set transition feedback via Gemini ("Shaandaar! 2 aur set baaki hain")
- Rest duration varies per exercise: 30s (cardio) to 90s (heavy compounds)
- After all sets complete, session ends with summary stats
- Progress bar shows rest progress visually

---

## Slide 11 — Multilingual Support

- **Home page language toggle**: Choose Hindi 🇮🇳 or English 🇬🇧 before starting workout
- Language preference saved to localStorage — persists across sessions
- Language synced to backend via WebSocket control message (no reconnection needed)
- Gemini prompt includes `[LANG] hi-IN` or `[LANG] en-IN` — responses match selected language
- Sarvam STT/TTS configured per language
- Coach personality adapts: Hindi = "Bhai, ekdam sahi!" / English = "Great form, keep going!"

---

## Slide 12 — Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Pose Detection | MoveNet Thunder (TensorFlow.js) — in-browser |
| Form Scoring | Custom angle-constraint engine |
| AI Coach Brain | **Gemini 2.5 Flash** (multi-model fallback) |
| Voice STT | **Sarvam AI** saarika:v2.5 |
| Voice TTS | **Sarvam AI** bulbul:v2 |
| Real-time Comms | WebSocket duplex |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express + TypeScript |
| Database | Prisma ORM + SQLite |
| Deployment | Docker + Nginx + HTTPS |
| Testing | Playwright E2E (16 tests, all passing) |

---

## Slide 13 — Testing & Quality

- **16 Playwright E2E tests** — all passing
- Tests cover: homepage rendering, language toggle, exercise selection, backend health, session CRUD, coaching start/stop, pose events, rep events, set completion, urgent form interruption threshold, Gemini analysis, history page
- Tested both above and below the 30% urgent threshold
- TTS-resilient architecture tested (coaching text degrades gracefully when voice fails)
- Docker deployment tested on production (fitsenseai.aidhunik.com)

---

## Slide 14 — What Makes This Different

| Feature | Other Fitness Apps | FitSenseAI |
|---------|-------------------|------------|
| Rep counting | ✅ | ✅ |
| Form scoring | ❌ | ✅ Real-time angle-based |
| Voice coaching | ❌ | ✅ Gemini-powered, context-aware |
| Hindi support | ❌ | ✅ Native Hindi voice agent |
| Proactive interruption | ❌ | ✅ Interrupts when form < 30% |
| No hardware needed | ❌ (some need bands/sensors) | ✅ Just a webcam + mic |
| In-browser AI | ❌ (cloud-dependent) | ✅ MoveNet runs locally |
| Conversational | ❌ | ✅ Ask questions mid-workout |

---

## Slide 15 — Future Roadmap

- **Mobile app** with camera pose detection (React Native + TFLite)
- **Workout plans** — multi-day programs with progressive overload
- **Social features** — leaderboards, challenges, friend workouts
- **More languages** — Tamil, Telugu, Bengali via Sarvam expansion
- **Wearable integration** — heart rate zones from smartwatch
- **Video recording** — save workouts with coach annotations for review
- **Calorie estimation** — MET-based tracking per exercise

---

## Closing Slide

**FitSenseAI** — Because everyone deserves a trainer who never takes a day off.

🌐 https://fitsenseai.aidhunik.com
📦 https://github.com/Akum030/formfit

Built with Gemini 2.5 Flash + Sarvam AI + MoveNet Thunder + React + Node.js
