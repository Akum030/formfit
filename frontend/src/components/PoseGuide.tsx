/**
 * PoseGuide — SVG reference posture showing the ideal form for the current exercise/phase.
 * Drawn as a simple stick figure in the correct position so users know what to aim for.
 */

import { useState, useEffect, useRef } from 'react';
import type { RepPhase } from '../types';

interface PoseGuideProps {
  exerciseId: string;
  phase: RepPhase;
}

// SVG stick figure points for each exercise/phase
// Coordinates are in a 100x120 viewBox
interface FigurePoints {
  head: [number, number];
  neck: [number, number];
  lShoulder: [number, number];
  rShoulder: [number, number];
  lElbow: [number, number];
  rElbow: [number, number];
  lWrist: [number, number];
  rWrist: [number, number];
  hip: [number, number];
  lHip: [number, number];
  rHip: [number, number];
  lKnee: [number, number];
  rKnee: [number, number];
  lAnkle: [number, number];
  rAnkle: [number, number];
}

const SQUAT_TOP: FigurePoints = {
  head: [50, 12], neck: [50, 20],
  lShoulder: [40, 25], rShoulder: [60, 25],
  lElbow: [35, 38], rElbow: [65, 38],
  lWrist: [38, 48], rWrist: [62, 48],
  hip: [50, 52], lHip: [45, 52], rHip: [55, 52],
  lKnee: [43, 72], rKnee: [57, 72],
  lAnkle: [42, 95], rAnkle: [58, 95],
};

const SQUAT_BOTTOM: FigurePoints = {
  head: [50, 22], neck: [50, 30],
  lShoulder: [40, 35], rShoulder: [60, 35],
  lElbow: [33, 45], rElbow: [67, 45],
  lWrist: [36, 55], rWrist: [64, 55],
  hip: [50, 60], lHip: [44, 60], rHip: [56, 60],
  lKnee: [38, 78], rKnee: [62, 78],
  lAnkle: [42, 95], rAnkle: [58, 95],
};

const PUSHUP_TOP: FigurePoints = {
  head: [20, 35], neck: [26, 38],
  lShoulder: [30, 40], rShoulder: [30, 40],
  lElbow: [30, 55], rElbow: [30, 55],
  lWrist: [30, 68], rWrist: [30, 68],
  hip: [55, 40], lHip: [55, 40], rHip: [55, 40],
  lKnee: [72, 42], rKnee: [72, 42],
  lAnkle: [88, 44], rAnkle: [88, 44],
};

const PUSHUP_BOTTOM: FigurePoints = {
  head: [20, 52], neck: [26, 52],
  lShoulder: [30, 53], rShoulder: [30, 53],
  lElbow: [28, 68], rElbow: [28, 68],
  lWrist: [30, 80], rWrist: [30, 80],
  hip: [55, 53], lHip: [55, 53], rHip: [55, 53],
  lKnee: [72, 55], rKnee: [72, 55],
  lAnkle: [88, 57], rAnkle: [88, 57],
};

const LUNGE_TOP: FigurePoints = {
  head: [50, 12], neck: [50, 20],
  lShoulder: [42, 25], rShoulder: [58, 25],
  lElbow: [38, 38], rElbow: [62, 38],
  lWrist: [40, 48], rWrist: [60, 48],
  hip: [50, 52], lHip: [46, 52], rHip: [54, 52],
  lKnee: [44, 72], rKnee: [56, 72],
  lAnkle: [43, 95], rAnkle: [57, 95],
};

const LUNGE_BOTTOM: FigurePoints = {
  head: [50, 16], neck: [50, 24],
  lShoulder: [42, 29], rShoulder: [58, 29],
  lElbow: [38, 42], rElbow: [62, 42],
  lWrist: [40, 52], rWrist: [60, 52],
  hip: [50, 55], lHip: [46, 55], rHip: [54, 55],
  lKnee: [36, 74], rKnee: [62, 78],
  lAnkle: [32, 95], rAnkle: [68, 95],
};

const CURL_TOP: FigurePoints = {
  head: [50, 12], neck: [50, 20],
  lShoulder: [40, 25], rShoulder: [60, 25],
  lElbow: [38, 40], rElbow: [62, 40],
  lWrist: [38, 55], rWrist: [62, 55],
  hip: [50, 55], lHip: [45, 55], rHip: [55, 55],
  lKnee: [44, 75], rKnee: [56, 75],
  lAnkle: [43, 95], rAnkle: [57, 95],
};

const CURL_BOTTOM: FigurePoints = {
  head: [50, 12], neck: [50, 20],
  lShoulder: [40, 25], rShoulder: [60, 25],
  lElbow: [38, 40], rElbow: [62, 40],
  lWrist: [34, 30], rWrist: [66, 30],
  hip: [50, 55], lHip: [45, 55], rHip: [55, 55],
  lKnee: [44, 75], rKnee: [56, 75],
  lAnkle: [43, 95], rAnkle: [57, 95],
};

const SHOULDER_PRESS_TOP: FigurePoints = {
  head: [50, 12], neck: [50, 20],
  lShoulder: [40, 25], rShoulder: [60, 25],
  lElbow: [36, 18], rElbow: [64, 18],
  lWrist: [34, 8], rWrist: [66, 8],
  hip: [50, 55], lHip: [45, 55], rHip: [55, 55],
  lKnee: [44, 75], rKnee: [56, 75],
  lAnkle: [43, 95], rAnkle: [57, 95],
};

const SHOULDER_PRESS_BOTTOM: FigurePoints = {
  head: [50, 12], neck: [50, 20],
  lShoulder: [40, 25], rShoulder: [60, 25],
  lElbow: [34, 38], rElbow: [66, 38],
  lWrist: [32, 25], rWrist: [68, 25],
  hip: [50, 55], lHip: [45, 55], rHip: [55, 55],
  lKnee: [44, 75], rKnee: [56, 75],
  lAnkle: [43, 95], rAnkle: [57, 95],
};

function getFigure(exerciseId: string, phase: RepPhase): FigurePoints {
  const isBottom = phase === 'bottom' || phase === 'eccentric';
  switch (exerciseId) {
    case 'squat': return isBottom ? SQUAT_BOTTOM : SQUAT_TOP;
    case 'pushup': return isBottom ? PUSHUP_BOTTOM : PUSHUP_TOP;
    case 'lunge': return isBottom ? LUNGE_BOTTOM : LUNGE_TOP;
    case 'bicep_curl': return isBottom ? CURL_BOTTOM : CURL_TOP;
    case 'shoulder_press': return isBottom ? SHOULDER_PRESS_BOTTOM : SHOULDER_PRESS_TOP;
    default: return SQUAT_TOP;
  }
}

const PHASE_LABELS: Record<RepPhase, string> = {
  top: 'Starting Position',
  eccentric: 'Going Down',
  bottom: 'Bottom Position',
  concentric: 'Coming Up',
};

function interpolateFigure(a: FigurePoints, b: FigurePoints, t: number): FigurePoints {
  const result = {} as FigurePoints;
  for (const key of Object.keys(a) as (keyof FigurePoints)[]) {
    result[key] = [
      a[key][0] + (b[key][0] - a[key][0]) * t,
      a[key][1] + (b[key][1] - a[key][1]) * t,
    ];
  }
  return result;
}

const ANIMATION_PHASES: RepPhase[] = ['top', 'eccentric', 'bottom', 'concentric'];

export function PoseGuide({ exerciseId, phase }: PoseGuideProps) {
  const [animPhaseIdx, setAnimPhaseIdx] = useState(0);
  const [interpT, setInterpT] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const topFig = getFigure(exerciseId, 'top');
  const bottomFig = getFigure(exerciseId, 'bottom');

  // Auto-cycle animation: top → down → bottom → up → repeat
  useEffect(() => {
    let idx = 0;
    let t = 0;
    const PHASE_DURATION = 800; // ms per phase transition

    function animate(timestamp: number) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      t += delta / PHASE_DURATION;
      if (t >= 1) {
        t = 0;
        idx = (idx + 1) % 4;
        setAnimPhaseIdx(idx);
      }
      setInterpT(t);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [exerciseId]);

  // Compute interpolated figure based on animation phase
  const animPhase = ANIMATION_PHASES[animPhaseIdx];
  let fig: FigurePoints;
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * interpT); // ease in-out
  if (animPhase === 'top') {
    fig = topFig; // hold at top
  } else if (animPhase === 'eccentric') {
    fig = interpolateFigure(topFig, bottomFig, eased); // going down
  } else if (animPhase === 'bottom') {
    fig = bottomFig; // hold at bottom
  } else {
    fig = interpolateFigure(bottomFig, topFig, eased); // coming up
  }

  const currentLabel = PHASE_LABELS[animPhase];

  const limbs: [keyof FigurePoints, keyof FigurePoints][] = [
    ['neck', 'hip'],
    ['neck', 'lShoulder'], ['neck', 'rShoulder'],
    ['hip', 'lHip'], ['hip', 'rHip'],
    ['lShoulder', 'lElbow'], ['lElbow', 'lWrist'],
    ['rShoulder', 'rElbow'], ['rElbow', 'rWrist'],
    ['lHip', 'lKnee'], ['lKnee', 'lAnkle'],
    ['rHip', 'rKnee'], ['rKnee', 'rAnkle'],
  ];

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Reference Pose</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
          {currentLabel}
        </span>
      </div>
      <div className="flex justify-center">
        <svg viewBox="0 0 100 120" width="120" height="120" className="opacity-90">
          <defs>
            <radialGradient id="figGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="55" r="45" fill="url(#figGlow)" />

          {limbs.map(([a, b], i) => (
            <line
              key={i}
              x1={fig[a][0]} y1={fig[a][1]}
              x2={fig[b][0]} y2={fig[b][1]}
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.7"
            />
          ))}

          <circle
            cx={fig.head[0]} cy={fig.head[1]}
            r="6" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.8"
          />

          {Object.entries(fig).map(([key, [x, y]]) => {
            if (key === 'head') return null;
            return (
              <circle
                key={key}
                cx={x} cy={y}
                r="2.5"
                fill="#22c55e"
                opacity="0.9"
              />
            );
          })}
        </svg>
      </div>
      <p className="text-[10px] text-white/40 text-center mt-1">
        Follow the movement pattern
      </p>
    </div>
  );
}
