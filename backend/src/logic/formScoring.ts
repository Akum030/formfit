/**
 * Form Scoring Engine
 *
 * Converts raw MoveNet keypoints into form scores (0-100%) per frame
 * and per rep. Uses angle-based constraints from exerciseDefinitions.
 */

import {
  type AngleConstraint,
  type ExerciseDefinition,
  type JointName,
  type RepPhase,
  JOINT_NAME_TO_INDEX,
} from './exerciseDefinitions';

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface FrameScore {
  score: number;           // 0..1
  scorePercent: number;    // 0..100
  issues: string[];
  phase: RepPhase;
}

export interface RepScore {
  repNumber: number;
  avgScore: number;        // 0..100
  minScore: number;
  issues: string[];
}

// ── Angle Computation ─────────────────────────────────────

/** Calculate angle at point B formed by segments BA and BC, in degrees (0-180). */
export function calculateAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/** Get a keypoint by JointName from the 17-keypoint array. */
export function getKeypoint(keypoints: Keypoint[], joint: JointName): Keypoint | null {
  const idx = JOINT_NAME_TO_INDEX[joint];
  if (idx === undefined || idx >= keypoints.length) return null;
  const kp = keypoints[idx];
  if (kp.score !== undefined && kp.score < 0.2) return null; // low confidence
  return kp;
}

/** Compute the angle for a joint triplet. Returns null if any keypoint is missing. */
export function computeAngleForTriplet(
  keypoints: Keypoint[],
  joints: [JointName, JointName, JointName]
): number | null {
  const a = getKeypoint(keypoints, joints[0]);
  const b = getKeypoint(keypoints, joints[1]);
  const c = getKeypoint(keypoints, joints[2]);
  if (!a || !b || !c) return null;
  return calculateAngle(a, b, c);
}

// ── Phase Detection ───────────────────────────────────────

export interface PhaseState {
  current: RepPhase;
  angle: number;
  repCount: number;
  wasAtBottom: boolean;
}

/** Determine movement phase and count reps. */
export function updatePhase(
  keypoints: Keypoint[],
  exercise: ExerciseDefinition,
  state: PhaseState
): PhaseState {
  const { primaryAngle, bottomThreshold, topThreshold } = exercise.phaseDetection;
  const angle = computeAngleForTriplet(keypoints, primaryAngle);
  if (angle === null) return state;

  const newState = { ...state, angle };

  // For curl exercises, "bottom" means small angle (contracted)
  const isCurl = exercise.pattern === 'curl';

  if (isCurl) {
    // Curl: bottom = small angle, top = large angle
    if (angle < bottomThreshold) {
      newState.current = 'bottom';
      newState.wasAtBottom = true;
    } else if (angle > topThreshold) {
      if (newState.wasAtBottom) {
        newState.repCount = state.repCount + 1;
        newState.wasAtBottom = false;
      }
      newState.current = 'top';
    } else {
      newState.current = newState.wasAtBottom ? 'concentric' : 'eccentric';
    }
  } else {
    // Standard exercises: bottom = small angle, top = large angle
    if (angle < bottomThreshold) {
      newState.current = 'bottom';
      newState.wasAtBottom = true;
    } else if (angle > topThreshold) {
      if (newState.wasAtBottom) {
        newState.repCount = state.repCount + 1;
        newState.wasAtBottom = false;
      }
      newState.current = 'top';
    } else {
      newState.current = newState.wasAtBottom ? 'concentric' : 'eccentric';
    }
  }

  return newState;
}

// ── Frame Scoring ─────────────────────────────────────────

/** Score how well a single constraint is met. Returns 0-1. */
function scoreConstraint(angle: number, constraint: AngleConstraint): number {
  if (angle >= constraint.min && angle <= constraint.max) {
    return 1.0;
  }
  // Linearly degrade outside range, with 30° margin
  const margin = 30;
  if (angle < constraint.min) {
    const diff = constraint.min - angle;
    return Math.max(0, 1 - diff / margin);
  }
  const diff = angle - constraint.max;
  return Math.max(0, 1 - diff / margin);
}

/** Score a single frame based on exercise definition for the current phase. */
export function scoreFrame(
  keypoints: Keypoint[],
  exercise: ExerciseDefinition,
  phase: RepPhase
): FrameScore {
  const relevantConstraints = exercise.angleConstraints.filter(
    (c) => c.phase === phase
  );

  if (relevantConstraints.length === 0) {
    // No constraints for this phase — check ALL constraints instead
    // DO NOT return 100% by default
    const anyConstraints = exercise.angleConstraints;
    if (anyConstraints.length === 0) {
      return { score: 0, scorePercent: 0, issues: ['No constraints defined'], phase };
    }
    // Fall through to check all constraints
    return scoreFrameWithConstraints(keypoints, anyConstraints, phase);
  }

  return scoreFrameWithConstraints(keypoints, relevantConstraints, phase);
}

function scoreFrameWithConstraints(
  keypoints: Keypoint[],
  constraints: AngleConstraint[],
  phase: RepPhase
): FrameScore {

  let totalWeight = 0;
  let weightedScore = 0;
  const issues: string[] = [];

  for (const constraint of constraints) {
    const angle = computeAngleForTriplet(keypoints, constraint.joints);
    if (angle === null) continue;

    const s = scoreConstraint(angle, constraint);
    weightedScore += s * constraint.weight;
    totalWeight += constraint.weight;

    if (s < 0.6) {
      issues.push(constraint.issueText);
    }
  }

  // If no constraints could be evaluated, return 0 not 100
  const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return {
    score,
    scorePercent: Math.round(score * 100),
    issues: totalWeight === 0
      ? ['Cannot see the relevant body parts — reposition yourself']
      : [...new Set(issues)],
    phase,
  };
}

// ── Rep Score Aggregation ─────────────────────────────────

export class RepScoreAggregator {
  private frameScores: number[] = [];
  private allIssues: string[] = [];
  private repNumber = 0;

  addFrameScore(fs: FrameScore) {
    this.frameScores.push(fs.scorePercent);
    this.allIssues.push(...fs.issues);
  }

  /** Call when a rep is completed. Returns rep score and resets. */
  completeRep(): RepScore {
    this.repNumber++;
    const scores = this.frameScores.length > 0 ? this.frameScores : [0];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const issues = [...new Set(this.allIssues)];

    this.frameScores = [];
    this.allIssues = [];

    return {
      repNumber: this.repNumber,
      avgScore: Math.round(avg),
      minScore: min,
      issues,
    };
  }

  get currentRepNumber() {
    return this.repNumber;
  }
}

// ── Score → Color ─────────────────────────────────────────

export type ScoreColor = 'green' | 'yellow' | 'red';

export function scoreToColor(scorePercent: number): ScoreColor {
  if (scorePercent >= 80) return 'green';
  if (scorePercent >= 50) return 'yellow';
  return 'red';
}

export function scoreToHex(scorePercent: number): string {
  if (scorePercent >= 80) return '#22c55e';
  if (scorePercent >= 50) return '#eab308';
  return '#ef4444';
}
