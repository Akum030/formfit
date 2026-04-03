/**
 * OverlaySkeleton — Draws MoveNet skeleton on the camera canvas overlay.
 *
 * Performance: Uses a persistent requestAnimationFrame loop that reads
 * keypoints from a ref (updated at full detection FPS) rather than
 * triggering React re-renders. This decouples smooth canvas drawing
 * from React's reconciliation cycle.
 *
 * Features:
 *  - Color-coded joints and limbs by form score
 *  - Real-time angle labels at key joints
 *  - Animated score badge with glow effect
 *  - Phase indicator on canvas
 */

import { useEffect, useRef, memo } from 'react';
import type { Keypoint, FrameScore, ExerciseDefinition, AngleConstraint } from '../types';
import {
  SKELETON_CONNECTIONS,
  JOINT_INDEX,
  getKeypointByName,
  computeAngle,
  scoreToHex,
  scoreToGradientColor,
} from '../utils/pose';
import type { JointName } from '../types';

interface OverlaySkeletonProps {
  canvas: HTMLCanvasElement | null;
  keypoints: Keypoint[];
  /** Direct ref to latest keypoints — enables smooth canvas drawing without React re-renders */
  keypointsRef?: React.RefObject<Keypoint[]>;
  frameScore: FrameScore | null;
  exercise: ExerciseDefinition | null;
  width: number;
  height: number;
  mirrored?: boolean;
}

const MIN_CONFIDENCE = 0.15;
const JOINT_RADIUS = 7;
const LINE_WIDTH = 4;

/**
 * Memoized skeleton overlay — uses rAF loop for smooth drawing.
 * Only re-creates the draw loop when canvas, exercise, or dimensions change.
 * Reads keypoints and frameScore from refs so React state throttling doesn't
 * affect drawing smoothness.
 */
export const OverlaySkeleton = memo(function OverlaySkeleton({
  canvas,
  keypoints,
  keypointsRef,
  frameScore,
  exercise,
  width,
  height,
}: OverlaySkeletonProps) {
  // Store latest values in refs so the rAF loop always has current data
  // without needing React state dependencies
  const frameScoreRef = useRef(frameScore);
  const exerciseRef = useRef(exercise);
  const fallbackKeypointsRef = useRef(keypoints);

  frameScoreRef.current = frameScore;
  exerciseRef.current = exercise;
  fallbackKeypointsRef.current = keypoints;

  useEffect(() => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    function draw() {
      if (!running || !ctx) return;

      // Read latest keypoints from ref (full speed) or fallback to state
      const kps = keypointsRef?.current ?? fallbackKeypointsRef.current;
      const fs = frameScoreRef.current;
      const ex = exerciseRef.current;

      ctx.clearRect(0, 0, width, height);

      if (kps.length === 0) {
        requestAnimationFrame(draw);
        return;
      }

      // Build per-limb color map based on exercise angle constraints
      const limbColorMap = ex && fs
        ? buildLimbColorMap(kps, ex, fs.phase)
        : null;
      const defaultColor = fs
        ? scoreToGradientColor(fs.scorePercent)
        : '#22c55e';

      // Draw connections (limbs) with per-limb coloring
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [jointA, jointB] of SKELETON_CONNECTIONS) {
        const a = getKeypointByName(kps, jointA, MIN_CONFIDENCE);
        const b = getKeypointByName(kps, jointB, MIN_CONFIDENCE);
        if (!a || !b) continue;

        const limbKey = `${jointA}-${jointB}`;
        const limbColor = limbColorMap?.get(limbKey) ?? defaultColor;

        // Glow effect for the limb
        ctx.save();
        ctx.shadowColor = limbColor;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = limbColor;
        ctx.lineWidth = LINE_WIDTH + 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();

        // Main limb line
        ctx.strokeStyle = limbColor;
        ctx.lineWidth = LINE_WIDTH;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Draw keypoints (joints) with per-joint coloring
      ctx.globalAlpha = 1;
      for (let i = 0; i < kps.length; i++) {
        const kp = kps[i];
        if (kp.score !== undefined && kp.score < MIN_CONFIDENCE) continue;

        const isPrimary = i >= 5;
        const radius = isPrimary ? JOINT_RADIUS : JOINT_RADIUS * 0.6;

        // Find best color for this joint from adjacent limbs
        const jointName = Object.keys(JOINT_INDEX).find(k => JOINT_INDEX[k as JointName] === i) as JointName | undefined;
        const jointColor = jointName && limbColorMap
          ? getJointColor(jointName, limbColorMap, defaultColor)
          : defaultColor;

        // Outer glow ring
        ctx.save();
        ctx.shadowColor = jointColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, radius + 2, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.restore();

        // Inner dot
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = jointColor;
        ctx.fill();
      }

      // Draw angle labels at key joints
      if (ex) {
        drawAngleLabels(ctx, kps, ex);
      }

      // Draw score badge (top-left)
      if (fs) {
        drawScoreBadge(ctx, fs);
      }

      // Draw phase indicator (bottom-center)
      if (fs) {
        drawPhaseIndicator(ctx, fs.phase, width);
      }

      ctx.globalAlpha = 1;

      requestAnimationFrame(draw);
    }

    // Start the persistent draw loop
    requestAnimationFrame(draw);

    return () => { running = false; };
  // Only restart loop when canvas/dimensions/exercise identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, exercise?.id, width, height]);

  return null;
});

function drawAngleLabels(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  exercise: ExerciseDefinition,
) {
  // Collect unique joint triplets from constraints
  const seen = new Set<string>();
  const triplets: { joints: [JointName, JointName, JointName]; phase: string }[] = [];

  for (const c of exercise.angleConstraints) {
    const key = c.joints.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    triplets.push({ joints: c.joints, phase: c.phase });
  }

  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.textAlign = 'center';

  for (const { joints } of triplets) {
    const angle = computeAngle(keypoints, joints, MIN_CONFIDENCE);
    if (angle === null) continue;

    // Position label at the vertex (middle joint)
    const vertex = getKeypointByName(keypoints, joints[1], MIN_CONFIDENCE);
    if (!vertex) continue;

    const text = `${Math.round(angle)}°`;
    const tx = vertex.x + 20;
    const ty = vertex.y - 10;

    // Background pill
    const metrics = ctx.measureText(text);
    const padding = 4;
    const bgW = metrics.width + padding * 2;
    const bgH = 16;

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(tx - bgW / 2, ty - bgH / 2, bgW, bgH, 4);
    ctx.fill();

    // Angle text
    ctx.globalAlpha = 1;
    const color = scoreAngleColor(angle, joints, exercise);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, ty + 4);
  }
}

function scoreAngleColor(
  angle: number,
  joints: [JointName, JointName, JointName],
  exercise: ExerciseDefinition,
): string {
  // Find matching constraint for these joints
  const constraint = exercise.angleConstraints.find(
    (c) => c.joints[0] === joints[0] && c.joints[1] === joints[1] && c.joints[2] === joints[2],
  );
  if (!constraint) return '#ffffff';

  if (angle >= constraint.min && angle <= constraint.max) return '#22c55e';
  const diff = angle < constraint.min
    ? constraint.min - angle
    : angle - constraint.max;
  if (diff < 15) return '#eab308';
  return '#ef4444';
}

function drawScoreBadge(ctx: CanvasRenderingContext2D, frameScore: FrameScore) {
  const x = 15;
  const y = 15;
  const w = 90;
  const h = 44;

  // Glow effect
  const hex = scoreToHex(frameScore.scorePercent);
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 14);
  ctx.fill();

  // Background
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();

  // Score text
  ctx.globalAlpha = 1;
  ctx.fillStyle = hex;
  ctx.font = 'bold 24px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${frameScore.scorePercent}%`, x + w / 2, y + 30);
}

function drawPhaseIndicator(ctx: CanvasRenderingContext2D, phase: string, canvasWidth: number) {
  const labels: Record<string, string> = {
    top: '⬆ READY',
    eccentric: '⬇ DOWN',
    bottom: '⏸ HOLD',
    concentric: '⬆ UP',
  };
  const colors: Record<string, string> = {
    top: '#06b6d4',
    eccentric: '#a855f7',
    bottom: '#eab308',
    concentric: '#22c55e',
  };

  const label = labels[phase] || phase;
  const color = colors[phase] || '#ffffff';
  const x = canvasWidth / 2;
  const y = 25;

  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';

  const metrics = ctx.measureText(label);
  const padding = 8;
  const bgW = metrics.width + padding * 2;
  const bgH = 20;

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(x - bgW / 2, y - bgH / 2, bgW, bgH, 6);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + 4);
}

// ── Per-limb coloring helpers ─────────────────────────────

/**
 * For each skeleton limb segment, compute a color (green/yellow/red)
 * based on how well the joints in that segment satisfy the exercise's
 * angle constraints for the current phase.
 */
function buildLimbColorMap(
  keypoints: Keypoint[],
  exercise: ExerciseDefinition,
  currentPhase: string
): Map<string, string> {
  const map = new Map<string, string>();

  // Score each constraint by its joint triplet
  const jointScores = new Map<string, number>(); // "joint1-joint2-joint3" → 0..1

  const phaseConstraints = exercise.angleConstraints.filter(c => c.phase === currentPhase);
  const constraints = phaseConstraints.length > 0 ? phaseConstraints : exercise.angleConstraints;

  for (const constraint of constraints) {
    const angle = computeAngle(keypoints, constraint.joints, MIN_CONFIDENCE);
    if (angle === null) continue;

    let score: number;
    if (angle >= constraint.min && angle <= constraint.max) {
      score = 1.0;
    } else {
      const diff = angle < constraint.min
        ? constraint.min - angle
        : angle - constraint.max;
      score = Math.max(0, 1 - diff / 30);
    }

    // Store per-joint: each joint in the triplet gets this score
    for (const j of constraint.joints) {
      const prev = jointScores.get(j);
      if (prev === undefined || score < prev) {
        jointScores.set(j, score);
      }
    }
  }

  // Map each skeleton limb to a color based on its joints' scores
  for (const [jointA, jointB] of SKELETON_CONNECTIONS) {
    const key = `${jointA}-${jointB}`;
    const scoreA = jointScores.get(jointA);
    const scoreB = jointScores.get(jointB);

    if (scoreA !== undefined || scoreB !== undefined) {
      // Use worst score of the two endpoint joints
      const worst = Math.min(scoreA ?? 1, scoreB ?? 1);
      map.set(key, limbScoreToColor(worst));
    }
    // If neither joint has constraint data, limb keeps default color
  }

  return map;
}

function limbScoreToColor(score: number): string {
  if (score >= 0.8) return '#22c55e'; // green
  if (score >= 0.5) return '#eab308'; // yellow
  return '#ef4444'; // red
}

/** Get the best color for a joint by looking at all adjacent limbs. */
function getJointColor(
  jointName: JointName,
  limbColorMap: Map<string, string>,
  defaultColor: string
): string {
  // Find any limb that includes this joint
  for (const [jointA, jointB] of SKELETON_CONNECTIONS) {
    if (jointA === jointName || jointB === jointName) {
      const key = `${jointA}-${jointB}`;
      const c = limbColorMap.get(key);
      if (c) return c;
    }
  }
  return defaultColor;
}
