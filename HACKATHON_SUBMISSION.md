# FitSenseAI — Hackathon Submission Fields

> Copy-paste these into the Devpost submission form.

---

## FIELD 1: Project Name (max 60 chars)

```
FitSenseAI — AI Gym Coach
```

---

## FIELD 2: Elevator Pitch (max 200 chars)

```
Real-time AI gym coach that watches your workout via webcam, scores your form using pose detection, and interrupts mid-exercise in Hindi or English when you're doing it wrong.
```

---

## FIELD 3: About the Project (Markdown)

```markdown
## Inspiration

Everyone wants to work out correctly but can't afford a personal trainer. Generic YouTube videos can't see YOU. We set out to build something that actually watches you, understands your movement in real time, and calls you out — loudly — when you're doing it wrong. Like a desi trainer who doesn't let you get away with lazy squats.

## What it does

**FitSenseAI** is a real-time AI gym trainer that:

- 📷 **Watches your form** using MoveNet Thunder pose detection (17 keypoints at 15+ FPS) running entirely in your browser via TensorFlow.js
- 📐 **Scores every rep** 0–100% using a custom angle-constraint engine per movement phase (top/bottom/eccentric/concentric) across **22 exercises**
- 🎙️ **Coaches you with voice** — Sarvam AI (STT + TTS) gives you spoken feedback in **Hindi by default**, switchable to English
- 🚨 **Interrupts mid-exercise** when form score drops below 40% — like a trainer physically stopping you to correct your form
- 💬 **Answers questions** naturally: speak "bhai meri form kaisi hai?" and the AI coach responds contextually using Gemini 2.5 Flash
- 📊 **Tracks your history** — sessions, rep scores, streak calendar stored in Prisma + SQLite

## How we built it

**Frontend (React 18 + TypeScript + Vite + TailwindCSS):**
- MoveNet Thunder loaded via `@tensorflow-models/pose-detection` — runs in-browser, no server round-trip for pose inference
- Custom `useFormScoring` hook calculates joint angles using law of cosines, compares against per-exercise, per-phase angle constraints
- `useVoiceAgent` hook: MediaRecorder buffers audio → streams over WebSocket to backend → plays back TTS audio via Web Audio API

**Backend (Node.js + Express + TypeScript):**
- `CoachEngine`: rate-limited proactive coaching triggers, bilingual Hindi/English messages, `checkUrgentFormInterruption()` fires when score < 40 (4s cooldown)
- `geminiClient`: Gemini 2.5 Flash via Google GenAI SDK — system prompt with `[LANG]` tag for bilingual coaching, multi-model fallback chain (2.5-flash → 2.5-flash-lite → 2.0-flash)
- `sarvamClient`: Sarvam AI STT (`saarika:v2.5`) and TTS (`bulbul:v2`, speaker `anushka`) — default `hi-IN`
- WebSocket `/ws/voice`: duplex audio stream, each connection tracks language from `?lang=` param

## Challenges we ran into

- **Rep counting accuracy**: MoveNet detects both sides of the body — we had to score the "best-side" angle at each frame to avoid counting half-reps
- **Hindi voice understanding**: Sarvam's STT returned transliterated Roman Hindi ("bhai kitna bacha hai") which required keyword matching in our fallback feedback engine
- **Voice interruption timing**: making the coach interrupt mid-rep without cutting off the user's own speech required WebSocket state tracking and an AudioContext cancel mechanism
- **Phase detection threshold calibration**: loosened joint angle thresholds significantly from textbook values — real humans at home have variable body proportions and camera angles

## Accomplishments that we're proud of

- A coach that **yells at you in Hindi** when your squat form breaks — "Arre bhai! Ghutne bahar rakho!" — this genuinely feels like a real trainer
- **22 exercises** covering home workouts and gym/dumbbell movements, all with custom biomechanical angle constraints
- The voice agent being **interruptible** — you can cut off the coach mid-sentence and ask your own question
- Full **end-to-end voice pipeline**: mic → WebSocket → WAV → Sarvam STT → Gemini prompt → Gemini response → Sarvam TTS → WAV → speaker in under 2 seconds

## What we learned

- TensorFlow.js MoveNet runs remarkably well in-browser for a model this size — pose inference at 15+ FPS on a standard laptop with no GPU
- Sarvam AI's Hindi voice output (`bulbul:v2`) sounds genuinely natural — far more so than any multilingual TTS we tested
- Gemini 2.5 Flash's short-context coaching responses (150 tokens) are fast enough for real-time use when the system prompt is tightly constrained
- Building bilingual AI products for Indian users requires more than just language translation — tone, idioms, and energy all need to match the cultural context

## What's next for FitSenseAI

- **Google Cloud Run deployment** for scalable global access
- **Gemini Live API integration** — replace the current request-response pattern with true streaming live audio for sub-500ms latency
- **Workout plan generation** — Gemini creates a weekly plan based on your history and goals
- **Multi-person support** — track multiple athletes in the same frame
- **Mobile PWA** — phone camera as portable gym trainer
```

---

## FIELD 4: Built With

```
TensorFlow.js, MoveNet Thunder, Google Gemini 2.5 Flash, Google GenAI SDK, Sarvam AI, React 18, TypeScript, Vite, TailwindCSS, Node.js, Express, WebSocket, Prisma, SQLite, Docker, Nginx
```

---

## FIELD 5: "Try it out" links

```
https://fitsenseai.aidhunik.com
https://github.com/Akum030/formfit
```

---

## ADDITIONAL INFO fields

**Submitter Type:** Individual

**Start Date:** 03-01-26

**Public Code Repo:** https://github.com/Akum030/formfit

**Reproducible Testing instructions in README:** Yes

**Proof of Google Cloud Deployment:**
> Use the Gemini API key pointing to Google AI Studio (Google Cloud AI platform).
> See: https://github.com/Akum030/formfit/blob/main/backend/src/services/geminiClient.ts
> (all coaching calls go through Google GenAI SDK → Gemini 2.5 Flash on Google Cloud)

**Architecture Diagram:** Uploaded to Image Gallery (see docs/architecture-diagram.png in repo)

**Category:** Live Agents 🗣️ (Real-time Audio/Vision interaction)

---

## SUBMISSION TEXT — Project Story Summary

FitSenseAI is a Live Agent that breaks the text-box paradigm: it **sees** your body through MoveNet pose detection, **hears** you speak in Hindi or English through Sarvam AI STT, and **speaks back** through Sarvam AI TTS — interrupting you mid-workout when your form breaks down, just like a human trainer would. Gemini 2.5 Flash powers all coaching intelligence, processing real-time form scores and user speech to generate contextually appropriate, bilingual corrections with the personality of a no-nonsense desi gym trainer.
