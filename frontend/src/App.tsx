/**
 * App — Main application shell with routing.
 *
 * Routes:
 *  - / → Home (exercise selection → session)
 *  - /history → Workout history
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { CameraView, type CameraViewRef } from './components/CameraView';
import { OverlaySkeleton } from './components/OverlaySkeleton';
import { SessionControls } from './components/SessionControls';
import { HistoryView } from './components/HistoryView';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { useMoveNet } from './hooks/useMoveNet';
import { useFormScoring } from './hooks/useFormScoring';
import { useVoiceAgent } from './hooks/useVoiceAgent';
import { useGeminiAnalysis } from './hooks/useGeminiAnalysis';
import { EXERCISES, getExerciseById } from './data/exercises';
import type { ExerciseSummary, CoachingMessage } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const exerciseSummaries: ExerciseSummary[] = EXERCISES.map((e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  defaultSets: e.defaultSets,
  defaultReps: e.defaultReps,
  restSeconds: e.restSeconds,
}));

function WorkoutPage() {
  const navigate = useNavigate();
  const cameraRef = useRef<CameraViewRef>(null);
  const [searchParams] = useSearchParams();

  // State
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastCoaching, setLastCoaching] = useState<CoachingMessage | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-select exercise from URL query param (e.g. /workout?exercise=squat)
  useEffect(() => {
    const ex = searchParams.get('exercise');
    if (ex && !selectedExerciseId) setSelectedExerciseId(ex);
  }, [searchParams, selectedExerciseId]);

  const selectedExercise = selectedExerciseId ? getExerciseById(selectedExerciseId) ?? null : null;

  // MoveNet
  const { keypoints, isLoading: isModelLoading, isReady: isModelReady, fps, startDetection, stopDetection } = useMoveNet();

  // Form Scoring
  const {
    frameScore, repScores, repCount, setNumber, phase, avgSessionScore,
    currentIssues, incrementSet,
  } = useFormScoring({
    exercise: selectedExercise,
    keypoints,
    sessionId,
    isActive: isSessionActive && !isPaused,
  });

  // Voice Agent
  const handleCoaching = useCallback((msg: CoachingMessage) => {
    setLastCoaching(msg);
  }, []);

  const { voiceState, lastTranscript, isMuted, toggleMute, playCoachingAudio } = useVoiceAgent({
    sessionId,
    isActive: isSessionActive,
    onCoaching: handleCoaching,
  });

  // Gemini AI Analysis
  const { aiAnalysis, aiScore, aiTip, isAnalyzing } = useGeminiAnalysis({
    exercise: selectedExercise,
    keypoints,
    sessionId,
    currentPhase: phase,
    repCount,
    isActive: isSessionActive && !isPaused,
  });

  // Blended score: combine local angle scoring with Gemini AI scoring
  const blendedScore = aiScore !== null
    ? Math.round(avgSessionScore * 0.4 + aiScore * 0.6) // AI gets more weight when available
    : avgSessionScore;

  // Camera ready → start MoveNet
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    if (isModelReady) {
      startDetection(video);
    }
  }, [isModelReady, startDetection]);

  // Start session
  const handleStartSession = useCallback(async () => {
    if (!selectedExerciseId) return;

    try {
      // Create session on backend
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: selectedExerciseId,
          userId: localStorage.getItem('gym-userId') || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionId(data.sessionId);

        // Start coaching
        const coachRes = await fetch(`${API_BASE}/api/coaching/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: data.sessionId,
            exerciseId: selectedExerciseId,
          }),
        });

        if (coachRes.ok) {
          const coachData = await coachRes.json();
          if (coachData.coaching) {
            setLastCoaching(coachData.coaching);
            if (coachData.coaching.audioBase64) {
              playCoachingAudio(coachData.coaching.audioBase64);
            }
          }
        }
      } else {
        // Fallback: create local session ID
        setSessionId(`local-${Date.now()}`);
      }
    } catch {
      // Offline mode
      setSessionId(`local-${Date.now()}`);
    }

    setIsSessionActive(false);
    // Start countdown: 3, 2, 1, GO!
    setCountdown(3);
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          if (prev === 1) {
            // Show "GO!" briefly then activate
            setCountdown(0);
            setTimeout(() => {
              setCountdown(null);
              setIsSessionActive(true);
              setIsPaused(false);
            }, 700);
          }
          return prev === 1 ? 0 : null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [selectedExerciseId, playCoachingAudio]);

  // End session
  const handleEndSession = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avgFormScore: avgSessionScore,
            totalReps: repCount,
          }),
        });
        await fetch(`${API_BASE}/api/coaching/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch { /* ignore */ }
    }

    setIsSessionActive(false);
    setSessionId(null);
    setIsPaused(false);
    setLastCoaching(null);
    stopDetection();
  }, [sessionId, avgSessionScore, repCount, stopDetection]);

  // Pause/resume
  const handlePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const CAMERA_WIDTH = 640;
  const CAMERA_HEIGHT = 480;

  return (
    <div className="flex-1 flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
        {/* Camera + Overlay */}
        <div className="flex-1 flex items-center justify-center">
          <CameraView
            ref={cameraRef}
            onVideoReady={handleVideoReady}
            width={CAMERA_WIDTH}
            height={CAMERA_HEIGHT}
            mirrored={true}
          >
            <OverlaySkeleton
              canvas={cameraRef.current?.getCanvas() ?? null}
              keypoints={keypoints}
              frameScore={frameScore}
              exercise={selectedExercise}
              width={CAMERA_WIDTH}
              height={CAMERA_HEIGHT}
              mirrored={true}
            />

            {/* Paused overlay */}
            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <div className="text-white text-3xl font-bold">⏸ PAUSED</div>
              </div>
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                <div className="text-center">
                  <div className="text-8xl font-black text-white animate-pulse drop-shadow-[0_0_30px_rgba(16,185,129,0.6)]">
                    {countdown === 0 ? 'GO!' : countdown}
                  </div>
                  <div className="text-white/60 text-lg mt-4 font-medium">
                    {countdown > 0 ? 'Get Ready...' : ''}
                  </div>
                </div>
              </div>
            )}
          </CameraView>
        </div>

        {/* Controls sidebar */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <div className="glass-card h-full">
            <SessionControls
              exercises={exerciseSummaries}
              selectedExerciseId={selectedExerciseId}
              onSelectExercise={setSelectedExerciseId}
              isSessionActive={isSessionActive}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
              onPause={handlePause}
              isPaused={isPaused}
              frameScore={frameScore}
              repScores={repScores}
              repCount={repCount}
              setNumber={setNumber}
              targetReps={selectedExercise?.defaultReps ?? 12}
              targetSets={selectedExercise?.defaultSets ?? 3}
              avgSessionScore={avgSessionScore}
              blendedScore={blendedScore}
              phase={phase}
              voiceState={voiceState}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              lastTranscript={lastTranscript}
              lastCoaching={lastCoaching}
              isModelLoading={isModelLoading}
              isModelReady={isModelReady}
              fps={fps}
              aiAnalysis={aiAnalysis}
              aiTip={aiTip}
              isAnalyzing={isAnalyzing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryRoute() {
  const navigate = useNavigate();
  return <HistoryView onBack={() => navigate('/')} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gym-900 flex flex-col">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/history" element={<HistoryRoute />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
