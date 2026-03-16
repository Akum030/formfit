/**
 * SessionControls — Hackathon-grade UI with animated circular score gauge,
 * AI insights panel, exercise cards, coaching chat, and rep animations.
 */

import { useState, useEffect, useRef } from 'react';
import type {
  ExerciseSummary, FrameScore, RepScore, CoachingMessage, VoiceState, RepPhase,
} from '../types';
import { scoreToColor } from '../utils/pose';
import type { GeminiAnalysis } from '../hooks/useGeminiAnalysis';
import { PoseGuide } from './PoseGuide';

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
  lastTranscript: string;
  lastCoaching: CoachingMessage | null;
  isModelLoading: boolean;
  isModelReady: boolean;
  fps: number;
  aiAnalysis: GeminiAnalysis | null;
  aiTip: string;
  isAnalyzing: boolean;
  language: string;
  onLanguageToggle: () => void;
}

const EXERCISE_ICONS: Record<string, string> = {
  squat: '🦵',
  pushup: '💪',
  lunge: '🏃',
  bicep_curl: '💪',
  shoulder_press: '🏋️',
};

const PHASE_CONFIG: Record<RepPhase, { label: string; color: string; icon: string }> = {
  top: { label: 'Ready', color: '#06b6d4', icon: '⬆️' },
  eccentric: { label: 'Going Down', color: '#a855f7', icon: '⬇️' },
  bottom: { label: 'Hold', color: '#eab308', icon: '⏸' },
  concentric: { label: 'Coming Up', color: '#22c55e', icon: '⬆️' },
};

export function SessionControls({
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
  lastTranscript,
  lastCoaching,
  isModelLoading,
  isModelReady,
  fps,
  aiAnalysis,
  aiTip,
  isAnalyzing,
  language,
  onLanguageToggle,
}: SessionControlsProps) {
  return (
    <div className="flex flex-col h-full gap-3 p-3 overflow-y-auto">
      {/* Top Status Bar */}
      <StatusBar isModelLoading={isModelLoading} isModelReady={isModelReady} fps={fps} isAnalyzing={isAnalyzing} />

      {/* Language Toggle */}
      <button
        onClick={onLanguageToggle}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-sm"
      >
        <span>{language === 'hi-IN' ? '🇮🇳' : '🇬🇧'}</span>
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

      {/* Active Session */}
      {isSessionActive && (
        <>
          {/* Animated Score Gauge */}
          <ScoreGauge
            score={blendedScore}
            localScore={frameScore?.scorePercent ?? 0}
            aiScore={aiAnalysis?.score ?? null}
            phase={phase}
          />

          {/* Rep & Set Counter */}
          <RepSetCounter
            repCount={repCount}
            targetReps={targetReps}
            setNumber={setNumber}
            targetSets={targetSets}
            repScores={repScores}
          />

          {/* Reference Pose Guide */}
          {selectedExerciseId && (
            <PoseGuide exerciseId={selectedExerciseId} phase={phase} />
          )}

          {/* AI Insights Panel */}
          {(aiAnalysis || aiTip) && (
            <AIInsightsPanel analysis={aiAnalysis} tip={aiTip} />
          )}

          {/* Form Issues */}
          {frameScore && frameScore.issues.length > 0 && (
            <IssuesPanel issues={frameScore.issues} />
          )}

          {/* Coach Chat Bubble */}
          <CoachBubble
            lastCoaching={lastCoaching}
            voiceState={voiceState}
            isMuted={isMuted}
            onToggleMute={onToggleMute}
            lastTranscript={lastTranscript}
          />

          {/* Session Controls */}
          <div className="flex gap-2 mt-auto pt-2">
            <button
              onClick={onPause}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              onClick={onEndSession}
              className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-all active:scale-95 border border-red-500/20"
            >
              ⏹ End
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center text-lg">
          🏋️
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Choose Exercise</h3>
          <p className="text-white/40 text-xs">Select to begin your AI-coached workout</p>
        </div>
      </div>

      <div className="grid gap-2">
        {exercises.map((ex) => {
          const isSelected = selectedId === ex.id;
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className={`group relative text-left p-3 rounded-xl transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/15 border border-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.1)]'
                  : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{EXERCISE_ICONS[ex.id] || '🏋️'}</span>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-white/80'}`}>
                    {ex.name}
                  </div>
                  <div className="text-white/40 text-xs mt-0.5">
                    {ex.category} · {ex.defaultSets}×{ex.defaultReps} · {ex.restSeconds}s rest
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

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
        {!selectedId ? 'Select an exercise' : !isModelReady ? 'Loading AI model...' : '🚀 Start AI Coaching'}
      </button>
    </div>
  );
}

// ── Animated Score Gauge ────────────────────────────

function ScoreGauge({ score, localScore, aiScore, phase }: {
  score: number; localScore: number; aiScore: number | null; phase: RepPhase;
}) {
  const animatedScore = useAnimatedValue(score, 200);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const glowColor = score >= 80 ? 'rgba(34,197,94,0.3)' : score >= 50 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)';
  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-4">
        {/* SVG Circular Gauge */}
        <div className="relative flex-shrink-0" style={{ width: 130, height: 130 }}>
          <svg width="130" height="130" viewBox="0 0 130 130" className="transform -rotate-90">
            <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="65" cy="65" r="54"
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
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
            <span className="text-3xl font-black font-mono leading-none" style={{ color: scoreColor }}>
              {Math.round(animatedScore)}
            </span>
            <span className="text-[10px] text-white/40 font-medium mt-0.5">FORM SCORE</span>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: `${phaseConfig.color}15` }}>
            <span className="text-xs">{phaseConfig.icon}</span>
            <span className="text-xs font-bold" style={{ color: phaseConfig.color }}>{phaseConfig.label}</span>
          </div>

          <div className="space-y-1.5">
            <ScoreBar label="Angle" value={localScore} color="#06b6d4" />
            {aiScore !== null && (
              <ScoreBar label="AI" value={aiScore} color="#a855f7" />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] text-white/40">Local</span>
            </div>
            {aiScore !== null && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span className="text-[10px] text-white/40">Gemini AI</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-8 font-medium">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold w-7 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Rep & Set Counter ───────────────────────────────

function RepSetCounter({ repCount, targetReps, setNumber, targetSets, repScores }: {
  repCount: number; targetReps: number; setNumber: number; targetSets: number; repScores: RepScore[];
}) {
  const repProgress = Math.min(1, repCount / targetReps);
  const setProgress = Math.min(1, (setNumber - 1 + repProgress) / targetSets);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-1">
          <span className="rep-count text-4xl font-black text-white font-mono leading-none">{repCount}</span>
          <span className="text-base text-white/30 font-medium">/ {targetReps}</span>
          <span className="text-white/40 text-xs ml-1">reps</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-cyan-400 font-mono">{setNumber}</span>
          <span className="text-sm text-white/30">/ {targetSets}</span>
          <span className="text-white/40 text-xs ml-1">set</span>
        </div>
      </div>

      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${repProgress * 100}%` }}
        />
      </div>

      {repScores.length > 0 && (
        <div className="flex gap-1 justify-center">
          {repScores.slice(-12).map((rs, i) => (
            <div
              key={i}
              className="rep-dot w-3 h-3 rounded-full transition-all duration-200"
              style={{
                backgroundColor: rs.avgScore >= 80 ? '#22c55e' : rs.avgScore >= 50 ? '#eab308' : '#ef4444',
                opacity: 0.5 + (rs.avgScore / 100) * 0.5,
              }}
              title={`Rep ${rs.repNumber}: ${rs.avgScore}%`}
            />
          ))}
        </div>
      )}

      <div className="mt-2 h-1 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500"
          style={{ width: `${setProgress * 100}%` }}
        />
      </div>
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
          <span className="text-xs">🧠</span>
        </div>
        <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">Gemini AI Insight</span>
      </div>

      {tip && (
        <p className="text-white/80 text-sm leading-relaxed">{tip}</p>
      )}

      {analysis && analysis.issues.length > 0 && (
        <div className="mt-2 space-y-1">
          {analysis.issues.slice(0, 2).map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-amber-400 text-xs mt-0.5">⚡</span>
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

function CoachBubble({ lastCoaching, voiceState, isMuted, onToggleMute, lastTranscript }: {
  lastCoaching: CoachingMessage | null; voiceState: VoiceState;
  isMuted: boolean; onToggleMute: () => void; lastTranscript: string;
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
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <span className="text-xs">🎙️</span>
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
                {voiceState === 'listening' ? 'Listening' :
                 voiceState === 'speaking' ? 'Speaking' :
                 voiceState === 'processing' ? 'Thinking' : 'Ready'}
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
          {isMuted ? '🔇' : '🎤'}
        </button>
      </div>

      {displayText && (
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
          <p className="text-white/80 text-sm leading-relaxed italic">
            &ldquo;{displayText}&rdquo;
            {displayText.length < (targetText.current?.length ?? 0) && (
              <span className="typing-cursor">|</span>
            )}
          </p>
        </div>
      )}

      {lastTranscript && (
        <div className="flex items-start gap-2">
          <span className="text-white/30 text-[10px] mt-0.5">You:</span>
          <span className="text-white/40 text-xs">{lastTranscript}</span>
        </div>
      )}
    </div>
  );
}

function VoiceIndicator({ state }: { state: VoiceState }) {
  if (state === 'listening') {
    return (
      <div className="flex items-center gap-[2px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[3px] bg-red-400 rounded-sm"
            style={{
              height: '8px',
              animation: `voice-bar 0.6s ease-in-out ${i * 0.15}s infinite alternate`,
            }}
          />
        ))}
      </div>
    );
  }
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

  useEffect(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const start = value;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + (target - start) * eased);

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
