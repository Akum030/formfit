/**
 * App — Main application shell with routing.
 *
 * Routes:
 *  - / → Home (exercise selection → session)
 *  - /history → Workout history
 */

import { useState, useCallback, useRef, useEffect, lazy, Suspense, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { CameraView, type CameraViewRef } from './components/CameraView';
import { OverlaySkeleton } from './components/OverlaySkeleton';
import { SessionControls } from './components/SessionControls';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { useMoveNet } from './hooks/useMoveNet';
import { useFormScoring } from './hooks/useFormScoring';
import { useVoiceAgent } from './hooks/useVoiceAgent';
import { useGeminiAnalysis } from './hooks/useGeminiAnalysis';
import { PoseGuide } from './components/PoseGuide';
import { EXERCISES, getExerciseById } from './data/exercises';
import type { ExerciseSummary, CoachingMessage } from './types';

// Lazy-load routes that aren't needed on initial page load
const FoodJournalPage = lazy(() => import('./pages/FoodJournalPage').then(m => ({ default: m.FoodJournalPage })));
const DietPlanPage = lazy(() => import('./pages/DietPlanPage').then(m => ({ default: m.DietPlanPage })));
const HistoryView = lazy(() => import('./components/HistoryView').then(m => ({ default: m.HistoryView })));
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
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('gym-language') || 'en-IN');
  const [isResting, setIsResting] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);

  // Cleanup countdown timer on unmount to prevent state updates on unmounted component
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    };
  }, []);

  // Auto-select exercise from URL query param (e.g. /workout?exercise=squat)
  useEffect(() => {
    const ex = searchParams.get('exercise');
    if (ex && !selectedExerciseId) setSelectedExerciseId(ex);
  }, [searchParams, selectedExerciseId]);

  const selectedExercise = selectedExerciseId ? getExerciseById(selectedExerciseId) ?? null : null;

  // MoveNet — keypointsRef provides full-speed access for canvas drawing
  const { keypoints, keypointsRef, isLoading: isModelLoading, isReady: isModelReady, fps, startDetection, stopDetection } = useMoveNet();

  // Form Scoring — with coaching callback for spoken feedback from pose/rep events
  // The speakCoachingRef bridges useFormScoring (defined first) to useVoiceAgent (defined after)
  const speakCoachingRef = useRef<(text: string) => void>(() => {});

  const handleFormCoaching = useCallback((text: string) => {
    speakCoachingRef.current(text);
    setLastCoaching({ text, audioBase64: '', trigger: 'form' });
  }, []);

  const {
    frameScore, repScores, repCount, setNumber, phase, avgSessionScore,
    currentIssues, incrementSet,
  } = useFormScoring({
    exercise: selectedExercise,
    keypoints,
    sessionId,
    isActive: isSessionActive && !isPaused && !isResting,
    onCoachingText: handleFormCoaching,
  });

  // Voice Agent
  const handleCoaching = useCallback((msg: CoachingMessage) => {
    setLastCoaching(msg);
  }, []);

  const { voiceState, isMuted, toggleMute, speakText, speakCoaching } = useVoiceAgent({
    sessionId,
    isActive: isSessionActive,
    language,
    onCoaching: handleCoaching,
  });

  // Wire up the coaching ref so useFormScoring callbacks can speak via browser TTS
  speakCoachingRef.current = speakText;

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

  const targetReps = selectedExercise?.defaultReps ?? 12;
  const targetSets = selectedExercise?.defaultSets ?? 3;
  const restSeconds = selectedExercise?.restSeconds ?? 30;

  // Auto set completion: when reps reach target, trigger rest
  const setCompletionTriggered = useRef(false);
  const endSessionRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!isSessionActive || isPaused || isResting) return;
    if (repCount >= targetReps && !setCompletionTriggered.current) {
      setCompletionTriggered.current = true;

      // Send set-complete event to backend
      if (sessionId) {
        fetch(`${API_BASE}/api/events/set-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, setNumber }),
        }).catch(() => {});
      }

      if (setNumber >= targetSets) {
        // All sets done — end workout
        endSessionRef.current();
        return;
      }

      // Start rest timer
      setIsResting(true);
      setRestTimeLeft(restSeconds);
    }
  }, [repCount, targetReps, isSessionActive, isPaused, isResting, sessionId, setNumber, targetSets, restSeconds]);

  // Rest countdown timer
  useEffect(() => {
    if (!isResting) return;
    const timer = setInterval(() => {
      setRestTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Rest finished — start next set
          setIsResting(false);
          setCompletionTriggered.current = false;
          incrementSet();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isResting, incrementSet]);

  // Track the video element so we can start detection when model finishes loading
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Camera ready → start MoveNet (if model is already loaded)
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    videoElementRef.current = video;
    if (isModelReady) {
      startDetection(video);
    }
  }, [isModelReady, startDetection]);

  // Fix race condition: if model loads AFTER camera started, start detection now
  useEffect(() => {
    if (isModelReady && videoElementRef.current && videoElementRef.current.readyState >= 2) {
      startDetection(videoElementRef.current);
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
            language,
          }),
        });

        if (coachRes.ok) {
          const coachData = await coachRes.json();
          if (coachData.coaching) {
            setLastCoaching(coachData.coaching);
            // Speak coaching — use natural Sarvam audio if available, else browser TTS
            if (coachData.coaching.text) {
              speakCoaching(coachData.coaching.text, coachData.coaching.audioBase64);
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
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          countdownTimerRef.current = null;
          if (prev === 1) {
            // Show "GO!" briefly then activate
            setCountdown(0);
            countdownTimeoutRef.current = setTimeout(() => {
              setCountdown(null);
              setIsSessionActive(true);
              setIsPaused(false);
              countdownTimeoutRef.current = null;
            }, 700);
          }
          return prev === 1 ? 0 : null;
        }
        return prev - 1;
      });
    }, 1000);
    countdownTimerRef.current = countdownTimer;
  }, [selectedExerciseId, speakCoaching, language]);

  // End session — use refs for score/reps to avoid re-creating callback on every frame
  const avgSessionScoreRef = useRef(avgSessionScore);
  const repCountRef = useRef(repCount);
  avgSessionScoreRef.current = avgSessionScore;
  repCountRef.current = repCount;

  const handleEndSession = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avgFormScore: avgSessionScoreRef.current,
            totalReps: repCountRef.current,
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
    setIsResting(false);
    setRestTimeLeft(0);
    setCompletionTriggered.current = false;
    stopDetection();
  }, [sessionId, stopDetection]);

  // Keep ref updated for use in effects defined before handleEndSession
  endSessionRef.current = handleEndSession;

  // Pause/resume
  const handlePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const handleLanguageToggle = useCallback(() => {
    setLanguage((prev) => {
      const next = prev === 'hi-IN' ? 'en-IN' : 'hi-IN';
      localStorage.setItem('gym-language', next);
      return next;
    });
  }, []);

  const CAMERA_WIDTH = 640;
  const CAMERA_HEIGHT = 480;

  return (
    <div className="flex-1 flex flex-col relative z-[1]">
      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row p-2 gap-2 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Left: Camera + Pose Guide side-by-side */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0">
          {/* Camera + Overlay */}
          <div className="flex-1 flex items-center justify-center min-h-0">
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
                keypointsRef={keypointsRef}
                frameScore={frameScore}
                exercise={selectedExercise}
                width={CAMERA_WIDTH}
                height={CAMERA_HEIGHT}
                mirrored={true}
              />

              {/* Paused overlay */}
              {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                  <div className="text-white text-3xl font-bold">PAUSED</div>
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

              {/* Rest timer overlay on camera */}
              {isResting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-15">
                  <div className="text-center">
                    <div className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-2">REST</div>
                    <div className="text-7xl font-black text-white font-mono drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                      {restTimeLeft}s
                    </div>
                    <div className="text-white/50 text-sm mt-3">
                      Set {setNumber} complete — next set soon
                    </div>
                  </div>
                </div>
              )}
            </CameraView>
          </div>

          {/* Pose Guide — large panel beside camera, same aspect ratio */}
          {isSessionActive && selectedExerciseId && (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <PoseGuide exerciseId={selectedExerciseId} phase={phase} fullSize />
            </div>
          )}
        </div>

        {/* Controls sidebar */}
        <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 min-h-0">
          <div className="glass-card h-full overflow-hidden">
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
              targetReps={targetReps}
              targetSets={targetSets}
              avgSessionScore={avgSessionScore}
              blendedScore={blendedScore}
              phase={phase}
              voiceState={voiceState}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              lastCoaching={lastCoaching}
              isModelLoading={isModelLoading}
              isModelReady={isModelReady}
              fps={fps}
              aiAnalysis={aiAnalysis}
              aiTip={aiTip}
              isAnalyzing={isAnalyzing}
              language={language}
              onLanguageToggle={handleLanguageToggle}
              isResting={isResting}
              restTimeLeft={restTimeLeft}
              restDuration={restSeconds}
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

// Error boundary catches lazy-load chunk failures (e.g. bad network) and lets user retry
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-red-400 text-lg font-bold">Failed to load page</div>
          <p className="text-white/40 text-sm text-center max-w-sm">
            This usually means a network error while loading the page. Check your connection and try again.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-sm border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading spinner for lazy routes
function RouteLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
        <div className="min-h-screen bg-gym-900 flex flex-col dynamic-bg">
        <Navbar />
        <RouteErrorBoundary>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/workout" element={<WorkoutPage />} />
            <Route path="/history" element={<HistoryRoute />} />
            <Route path="/food-journal" element={<FoodJournalPage />} />
            <Route path="/diet-plan" element={<DietPlanPage />} />
          </Routes>
        </Suspense>
        </RouteErrorBoundary>
      </div>
    </BrowserRouter>
  );
}
