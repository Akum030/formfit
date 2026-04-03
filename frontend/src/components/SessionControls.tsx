/**
 * SessionControls — Hackathon-grade UI with animated circular score gauge,
 * AI insights panel, exercise cards, coaching chat, and rep animations.
 *
 * Wrapped with React.memo to prevent re-renders from parent state changes
 * (e.g. keypoints updating at 4/sec) that don't affect this component.
 */

import { useState, useEffect, useRef, memo } from 'react';
import type {
  ExerciseSummary, FrameScore, RepScore, CoachingMessage, VoiceState, RepPhase,
} from '../types';
import type { GeminiAnalysis } from '../hooks/useGeminiAnalysis';

interface SessionControlsProps {
  exercises: ExerciseSummary[];
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  isSessionActive: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
  onPause: () => void;
  isPaused: boolean;
  frameScore: FrameScore | null;
  repScores: RepScore[];
  repCount: number;
  setNumber: number;
  targetReps: number;
  targetSets: number;
  avgSessionScore: number;
  blendedScore: number;
  phase: RepPhase;
  voiceState: VoiceState;
  isMuted: boolean;
  onToggleMute: () => void;
  lastCoaching: CoachingMessage | null;
  isModelLoading: boolean;
  isModelReady: boolean;
  fps: number;
  aiAnalysis: GeminiAnalysis | null;
  aiTip: string;
  isAnalyzing: boolean;
  language: string;
  onLanguageToggle: () => void;
  isResting?: boolean;
  restTimeLeft?: number;
  restDuration?: number;
}

const EXERCISE_ICONS: Record<string, string> = {
  squat: '🦵', pushup: '💪', lunge: '🏃', jumping_jacks: '⭐', high_knees: '🦿',
  glute_bridge: '🍑', calf_raise: '🦶', tricep_dip: '💎', wall_sit: '🧱',
  sumo_squat: '🏋️', standing_crunch: '🔥', leg_raise: '🦵',
  bicep_curl: '💪', shoulder_press: '🏋️', lateral_raise: '🤸', front_raise: '🙌',
  dumbbell_row: '🚣', hammer_curl: '🔨', deadlift: '⚡', goblet_squat: '🏆',
  overhead_tricep: '💎',
};

const PHASE_CONFIG: Record<RepPhase, { label: string; color: string; icon: string }> = {
  top: { label: 'Ready', color: '#06b6d4', icon: '\u25B2' },
  eccentric: { label: 'Going Down', color: '#a855f7', icon: '\u25BC' },
  bottom: { label: 'Hold', color: '#eab308', icon: '\u25A0' },
  concentric: { label: 'Coming Up', color: '#22c55e', icon: '\u25B2' },
};

export const SessionControls = memo(function SessionControls({
  exercises,
  selectedExerciseId,
  onSelectExercise,
  isSessionActive,
  onStartSession,
  onEndSession,
  onPause,
  isPaused,
  frameScore,
  repScores,
  repCount,
  setNumber,
  targetReps,
  targetSets,
  avgSessionScore,
  blendedScore,
  phase,
  voiceState,
  isMuted,
  onToggleMute,
  lastCoaching,
  isModelLoading,
  isModelReady,
  fps,
  aiAnalysis,
  aiTip,
  isAnalyzing,
  language,
  onLanguageToggle,
  isResting = false,
  restTimeLeft = 0,
  restDuration = 30,
}: SessionControlsProps) {
  return (
    <div className="flex flex-col h-full gap-2 p-2 overflow-y-auto">
      {/* Top Status Bar */}
      <StatusBar isModelLoading={isModelLoading} isModelReady={isModelReady} fps={fps} isAnalyzing={isAnalyzing} />

      {/* Language Toggle */}
      <button
        onClick={onLanguageToggle}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-sm"
      >
        <span className="text-emerald-400 font-bold text-xs">{language === 'hi-IN' ? 'HI' : 'EN'}</span>
        <span className="text-white/60 font-medium">{language === 'hi-IN' ? 'हिंदी' : 'English'}</span>
        <span className="text-white/30 text-xs ml-1">tap to switch</span>
      </button>

      {/* Pre-session: Exercise Selection */}
      {!isSessionActive && (
        <ExerciseSelector
          exercises={exercises}
          selectedId={selectedExerciseId}
          onSelect={onSelectExercise}
          onStart={onStartSession}
          isModelReady={isModelReady}
        />
      )}

      {/* Active Session — Compact no-scroll layout */}
      {isSessionActive && (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {/* Rest Timer Overlay */}
          {isResting && (
            <div className="glass-card p-4 border border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-transparent text-center space-y-2 animate-fade-in-up">
              <div className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Rest Period</div>
              <div className="text-4xl font-black text-white font-mono">{restTimeLeft}s</div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-1000"
                  style={{ width: `${restDuration > 0 ? ((restDuration - restTimeLeft) / restDuration) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Score + Rep/Set — side by side */}
          <div className="grid grid-cols-2 gap-2">
            <ScoreGauge
              score={blendedScore}
              localScore={frameScore?.scorePercent ?? 0}
              aiScore={aiAnalysis?.score ?? null}
              phase={phase}
            />
            <RepSetCounter
              repCount={repCount}
              targetReps={targetReps}
              setNumber={setNumber}
              targetSets={targetSets}
              repScores={repScores}
            />
          </div>

          {/* Form Issues — compact */}
          {frameScore && frameScore.issues.length > 0 && (
            <IssuesPanel issues={frameScore.issues} />
          )}

          {/* AI Insights */}
          {(aiAnalysis || aiTip) && <AIInsightsPanel analysis={aiAnalysis} tip={aiTip} />}

          {/* Coach Chat Bubble */}
          <CoachBubble
            lastCoaching={lastCoaching}
            voiceState={voiceState}
            isMuted={isMuted}
            onToggleMute={onToggleMute}
          />

          {/* Session Controls — always at bottom */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onPause}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all active:scale-95"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={onEndSession}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-semibold text-sm hover:bg-red-500/30 transition-all active:scale-95 border border-red-500/20"
            >
              End
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Status Bar ──────────────────────────────────────

function StatusBar({ isModelLoading, isModelReady, fps, isAnalyzing }: {
  isModelLoading: boolean; isModelReady: boolean; fps: number; isAnalyzing: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isModelReady ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : isModelLoading ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-white/60 text-xs font-medium">
          {isModelLoading ? 'Loading MoveNet...' : isModelReady ? `MoveNet · ${fps} FPS` : 'Error'}
        </span>
      </div>
      {isAnalyzing && (
        <div className="flex items-center gap-1.5">
          <div className="ai-pulse w-2 h-2 rounded-full bg-violet-400" />
          <span className="text-violet-400 text-xs font-medium">AI Analyzing</span>
        </div>
      )}
    </div>
  );
}

// ── Exercise Selector ───────────────────────────────

function ExerciseSelector({ exercises, selectedId, onSelect, onStart, isModelReady }: {
  exercises: ExerciseSummary[]; selectedId: string | null; onSelect: (id: string) => void;
  onStart: () => void; isModelReady: boolean;
}) {
  return (
    <div className="glass-card p-4 space-y-3">
      {/* Heading */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center text-xs font-black text-emerald-400">
          FIT
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Choose Exercise</h3>
          <p className="text-white/40 text-xs">Select from {exercises.length} exercises below</p>
        </div>
      </div>

      {/* Dropdown */}
      <div className="relative">
        <select
          value={selectedId ?? ''}
          onChange={(e) => e.target.value && onSelect(e.target.value)}
          className="w-full appearance-none px-4 py-3 pr-10 rounded-xl
            bg-white/[0.05] border border-white/[0.12]
            text-white text-sm font-medium
            focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15
            hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          <option value="" disabled className="bg-gray-900 text-white/40">— pick an exercise —</option>
          {/* Group by category */}
          {Array.from(new Set(exercises.map(e => e.category))).map(cat => (
            <optgroup key={cat} label={cat} className="bg-gray-900 text-white/60 font-semibold">
              {exercises.filter(e => e.category === cat).map(ex => (
                <option key={ex.id} value={ex.id} className="bg-gray-900 text-white py-1">
                  {EXERCISE_ICONS[ex.id] ?? 'EX'} {ex.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {/* Chevron icon */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Selected exercise info chip */}
      {selectedId && (() => {
        const ex = exercises.find(e => e.id === selectedId);
        if (!ex) return null;
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-sm font-bold text-emerald-400">{EXERCISE_ICONS[ex.id] ?? 'EX'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm truncate">{ex.name}</div>
              <div className="text-emerald-400/70 text-xs">{ex.category} · {ex.defaultSets} sets × {ex.defaultReps} reps · {ex.restSeconds}s rest</div>
            </div>
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs">✓</span>
            </div>
          </div>
        );
      })()}

      <button
        onClick={onStart}
        disabled={!selectedId || !isModelReady}
        className="w-full py-3.5 rounded-xl font-bold text-white text-sm
          bg-gradient-to-r from-emerald-500 to-cyan-500
          shadow-[0_4px_20px_rgba(52,211,153,0.3)]
          hover:shadow-[0_4px_30px_rgba(52,211,153,0.5)]
          hover:translate-y-[-1px]
          active:translate-y-0 active:shadow-[0_2px_10px_rgba(52,211,153,0.2)]
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0
          transition-all duration-200"
      >
        {!selectedId ? 'Select an exercise first' : !isModelReady ? 'Loading AI model...' : 'Start AI Coaching'}
      </button>
    </div>
  );
}

// ── Animated Score Gauge ────────────────────────────

function ScoreGauge({ score, localScore, aiScore, phase }: {
  score: number; localScore: number; aiScore: number | null; phase: RepPhase;
}) {
  const animatedScore = useAnimatedValue(score, 200);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const glowColor = score >= 80 ? 'rgba(34,197,94,0.3)' : score >= 50 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)';
  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <div className="glass-card p-3 flex flex-col items-center justify-center">
      {/* Compact SVG Circular Gauge */}
      <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke={scoreColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease',
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono leading-none" style={{ color: scoreColor }}>
            {Math.round(animatedScore)}
          </span>
          <span className="text-[8px] text-white/40 font-medium mt-0.5">FORM</span>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md" style={{ backgroundColor: `${phaseConfig.color}15` }}>
        <span className="text-[10px]">{phaseConfig.icon}</span>
        <span className="text-[10px] font-bold" style={{ color: phaseConfig.color }}>{phaseConfig.label}</span>
      </div>
    </div>
  );
}

// ── Rep & Set Counter ───────────────────────────────

function RepSetCounter({ repCount, targetReps, setNumber, targetSets, repScores }: {
  repCount: number; targetReps: number; setNumber: number; targetSets: number; repScores: RepScore[];
}) {
  const repProgress = Math.min(1, repCount / targetReps);

  return (
    <div className="glass-card p-3 flex flex-col justify-center">
      <div className="text-center mb-2">
        <div className="flex items-baseline justify-center gap-1">
          <span className="rep-count text-3xl font-black text-white font-mono leading-none">{repCount}</span>
          <span className="text-sm text-white/30 font-medium">/ {targetReps}</span>
        </div>
        <span className="text-white/40 text-[10px]">reps</span>
      </div>

      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${repProgress * 100}%` }}
        />
      </div>

      <div className="flex items-baseline justify-center gap-1">
        <span className="text-lg font-bold text-cyan-400 font-mono">{setNumber}</span>
        <span className="text-xs text-white/30">/ {targetSets} set</span>
      </div>

      {repScores.length > 0 && (
        <div className="flex gap-0.5 justify-center mt-1.5 flex-wrap">
          {repScores.slice(-8).map((rs, i) => (
            <div
              key={i}
              className="rep-dot w-2.5 h-2.5 rounded-full transition-all duration-200"
              style={{
                backgroundColor: rs.avgScore >= 80 ? '#22c55e' : rs.avgScore >= 50 ? '#eab308' : '#ef4444',
                opacity: 0.5 + (rs.avgScore / 100) * 0.5,
              }}
              title={`Rep ${rs.repNumber}: ${rs.avgScore}%`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Insights Panel ───────────────────────────────

function AIInsightsPanel({ analysis, tip }: { analysis: GeminiAnalysis | null; tip: string }) {
  return (
    <div className="glass-card p-3 border border-violet-500/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
          <span className="text-[8px] font-black text-violet-400">AI</span>
        </div>
        <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">AI Insight</span>
      </div>

      {tip && (
        <p className="text-white/80 text-sm leading-relaxed">{tip}</p>
      )}

      {analysis && analysis.issues.length > 0 && (
        <div className="mt-2 space-y-1">
          {analysis.issues.slice(0, 2).map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-amber-400 text-xs mt-0.5">-</span>
              <span className="text-white/60 text-xs">{issue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Issues Panel ────────────────────────────────────

function IssuesPanel({ issues }: { issues: string[] }) {
  return (
    <div className="glass-card p-3 border-l-2 border-amber-400/60">
      <div className="text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Form Corrections</div>
      {issues.slice(0, 3).map((issue, i) => (
        <div key={i} className="flex items-start gap-2 mb-1 last:mb-0">
          <span className="text-amber-400 text-xs leading-5">▸</span>
          <span className="text-white/70 text-xs leading-5">{issue}</span>
        </div>
      ))}
    </div>
  );
}

// ── Coach Chat Bubble ───────────────────────────────

function CoachBubble({ lastCoaching, voiceState, isMuted, onToggleMute }: {
  lastCoaching: CoachingMessage | null; voiceState: VoiceState;
  isMuted: boolean; onToggleMute: () => void;
}) {
  const [displayText, setDisplayText] = useState('');
  const targetText = useRef('');

  useEffect(() => {
    if (!lastCoaching?.text || lastCoaching.text === targetText.current) return;
    targetText.current = lastCoaching.text;
    let idx = 0;
    setDisplayText('');
    const interval = setInterval(() => {
      idx++;
      setDisplayText(targetText.current.slice(0, idx));
      if (idx >= targetText.current.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [lastCoaching?.text]);

  return (
    <div className="glass-card p-2.5 space-y-1.5 flex flex-col min-h-[120px] max-h-[160px]">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            </div>
            {voiceState === 'speaking' && (
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div>
            <span className="text-white/90 text-xs font-bold">AI Coach</span>
            <div className="flex items-center gap-1">
              <VoiceIndicator state={voiceState} />
              <span className="text-white/40 text-[10px]">
                {voiceState === 'speaking' ? 'Speaking' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onToggleMute}
          className={`p-2 rounded-lg text-xs transition-all ${
            isMuted
              ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
              : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1]'
          }`}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {displayText && (
        <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/[0.06] flex-1 min-h-[48px] max-h-[72px] overflow-y-auto">
          <p className="text-white/80 text-sm leading-relaxed italic">
            &ldquo;{displayText}&rdquo;
            {displayText.length < (targetText.current?.length ?? 0) && (
              <span className="typing-cursor">|</span>
            )}
          </p>
        </div>
      )}
      {!displayText && (
        <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/[0.06] flex-1 min-h-[48px] max-h-[72px] flex items-center justify-center">
          <p className="text-white/20 text-xs italic">Coach will speak here...</p>
        </div>
      )}

    </div>
  );
}

function VoiceIndicator({ state }: { state: VoiceState }) {
  if (state === 'speaking') {
    return (
      <div className="flex items-center gap-[2px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-[2px] bg-cyan-400 rounded-sm"
            style={{
              height: '10px',
              animation: `voice-bar 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </div>
    );
  }
  return <div className="w-2 h-2 rounded-full bg-white/20" />;
}

// ── Hooks ───────────────────────────────────────────

function useAnimatedValue(target: number, duration = 200): number {
  const [value, setValue] = useState(target);
  const animationRef = useRef<number | null>(null);
  // Track the last displayed value via ref to avoid stale closure in animation
  const currentRef = useRef(target);

  useEffect(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const start = currentRef.current;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + (target - start) * eased;
      currentRef.current = next;
      setValue(next);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [target, duration]);

  return value;
}
