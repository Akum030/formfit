/**
 * Exercise Classifier
 *
 * Classifies what exercise the user is performing based on a sliding window
 * of keypoint data. Uses pattern-matching on joint angle trajectories.
 *
 * Inspired by:
 *  - Exercise_tracking repo: MoveNet + dense NN for exercise classification
 *  - ai-workout-assistant: pattern-based rep counting
 */

import { type JointName, JOINT_NAME_TO_INDEX, type MovementPattern } from './exerciseDefinitions';
import { type Keypoint, computeAngleForTriplet } from './formScoring';

interface ClassificationResult {
  exerciseId: string | null;
  confidence: number; // 0..1
  pattern: MovementPattern | null;
}

interface AngleHistory {
  kneeAngle: number[];       // hip-knee-ankle
  elbowAngle: number[];      // shoulder-elbow-wrist
  hipAngle: number[];        // shoulder-hip-knee
  bodyLineAngle: number[];   // shoulder-hip-ankle
}

/** Build angle history from a window of keypoint frames. */
function buildAngleHistory(frames: Keypoint[][]): AngleHistory {
  const kneeAngle: number[] = [];
  const elbowAngle: number[] = [];
  const hipAngle: number[] = [];
  const bodyLineAngle: number[] = [];

  for (const kps of frames) {
    const knee = computeAngleForTriplet(kps, ['left_hip', 'left_knee', 'left_ankle']);
    const elbow = computeAngleForTriplet(kps, ['left_shoulder', 'left_elbow', 'left_wrist']);
    const hip = computeAngleForTriplet(kps, ['left_shoulder', 'left_hip', 'left_knee']);
    const body = computeAngleForTriplet(kps, ['left_shoulder', 'left_hip', 'left_ankle']);

    if (knee !== null) kneeAngle.push(knee);
    if (elbow !== null) elbowAngle.push(elbow);
    if (hip !== null) hipAngle.push(hip);
    if (body !== null) bodyLineAngle.push(body);
  }

  return { kneeAngle, elbowAngle, hipAngle, bodyLineAngle };
}

/** Check if an angle array shows oscillation (up-down pattern). */
function hasOscillation(angles: number[], threshold: number): boolean {
  if (angles.length < 6) return false;
  const min = Math.min(...angles);
  const max = Math.max(...angles);
  return (max - min) > threshold;
}

/** Get mean angle. */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Detect body orientation: upright or horizontal. */
function isUpright(frames: Keypoint[][]): boolean {
  let uprightCount = 0;
  for (const kps of frames) {
    const shoulder = kps[JOINT_NAME_TO_INDEX['left_shoulder']];
    const hip = kps[JOINT_NAME_TO_INDEX['left_hip']];
    if (shoulder && hip && shoulder.y < hip.y) {
      uprightCount++;
    }
  }
  return uprightCount > frames.length * 0.6;
}

/**
 * Classify exercise from a sliding window of keypoint frames.
 * Uses heuristic pattern matching on angle trajectories.
 */
export function classifyExerciseFromWindow(frames: Keypoint[][]): ClassificationResult {
  if (frames.length < 8) {
    return { exerciseId: null, confidence: 0, pattern: null };
  }

  const hist = buildAngleHistory(frames);
  const upright = isUpright(frames);

  const kneeOsc = hasOscillation(hist.kneeAngle, 30);
  const elbowOsc = hasOscillation(hist.elbowAngle, 30);
  const meanBodyLine = mean(hist.bodyLineAngle);

  // ── Squat: upright + knee oscillation + hip oscillation
  if (upright && kneeOsc && !elbowOsc) {
    const kneeRange = Math.max(...hist.kneeAngle) - Math.min(...hist.kneeAngle);
    if (kneeRange > 40) {
      return { exerciseId: 'squat', confidence: 0.85, pattern: 'squat' };
    }
  }

  // ── Lunge: upright + knee oscillation + asymmetric leg positions
  if (upright && kneeOsc) {
    // If knee range is moderate and hip angle shows lunge pattern
    const kneeRange = Math.max(...hist.kneeAngle) - Math.min(...hist.kneeAngle);
    if (kneeRange > 25 && kneeRange < 50) {
      return { exerciseId: 'lunge', confidence: 0.6, pattern: 'lunge' };
    }
  }

  // ── Push-up: horizontal body + elbow oscillation
  if (!upright && elbowOsc && meanBodyLine > 140) {
    return { exerciseId: 'pushup', confidence: 0.8, pattern: 'horizontal_push' };
  }

  // ── Shoulder Press: upright + elbow oscillation + wrists above shoulders
  if (upright && elbowOsc) {
    const lastFrame = frames[frames.length - 1];
    const wrist = lastFrame[JOINT_NAME_TO_INDEX['left_wrist']];
    const shoulder = lastFrame[JOINT_NAME_TO_INDEX['left_shoulder']];
    if (wrist && shoulder && wrist.y < shoulder.y) {
      return { exerciseId: 'shoulder_press', confidence: 0.7, pattern: 'vertical_push' };
    }
  }

  // ── Bicep Curl: upright + elbow oscillation + wrists below shoulders
  if (upright && elbowOsc) {
    const elbowRange = Math.max(...hist.elbowAngle) - Math.min(...hist.elbowAngle);
    if (elbowRange > 60) {
      return { exerciseId: 'bicep_curl', confidence: 0.75, pattern: 'curl' };
    }
  }

  return { exerciseId: null, confidence: 0, pattern: null };
}

/**
 * Check if predicted exercise matches the selected exercise.
 * Returns a mismatch warning if confident about a different exercise.
 */
export function checkExerciseMismatch(
  selectedExerciseId: string,
  predicted: ClassificationResult
): { mismatch: boolean; message: string } {
  if (!predicted.exerciseId || predicted.confidence < 0.6) {
    return { mismatch: false, message: '' };
  }

  if (predicted.exerciseId !== selectedExerciseId && predicted.confidence >= 0.7) {
    return {
      mismatch: true,
      message: `You seem to be doing ${predicted.exerciseId} instead of ${selectedExerciseId}. Switch exercises or check your form.`,
    };
  }

  return { mismatch: false, message: '' };
}
