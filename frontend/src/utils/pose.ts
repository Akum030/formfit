/**
 * Pose Utilities — Angle calculation, keypoint access, skeleton connections.
 *
 * All angle math runs on the frontend at ~15 FPS for real-time form scoring.
 */

import type { Keypoint, JointName, ScoreColor } from '../types';

// ── Keypoint Index Map ────────────────────────────────────

export const JOINT_INDEX: Record<JointName, number> = {
  nose: 0,
  left_eye: 1, right_eye: 2,
  left_ear: 3, right_ear: 4,
  left_shoulder: 5, right_shoulder: 6,
  left_elbow: 7, right_elbow: 8,
  left_wrist: 9, right_wrist: 10,
  left_hip: 11, right_hip: 12,
  left_knee: 13, right_knee: 14,
  left_ankle: 15, right_ankle: 16,
};

// ── Skeleton Connections (for overlay drawing) ────────────

export const SKELETON_CONNECTIONS: [JointName, JointName][] = [
  // Torso
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  // Left arm
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  // Right arm
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  // Left leg
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  // Right leg
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

// ── Angle Calculation ─────────────────────────────────────

/**
 * Calculate angle at point B formed by segments BA and BC.
 * Returns degrees (0-180).
 */
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

// ── Keypoint Helpers ──────────────────────────────────────

/** Get keypoint by joint name. Returns null if missing or low confidence. */
export function getKeypointByName(
  keypoints: Keypoint[],
  joint: JointName,
  minScore = 0.15
): Keypoint | null {
  const idx = JOINT_INDEX[joint];
  if (idx === undefined || idx >= keypoints.length) return null;
  const kp = keypoints[idx];
  if (kp.score !== undefined && kp.score < minScore) return null;
  return kp;
}

/** Compute angle for a joint triplet. Returns null if any keypoint is missing. */
export function computeAngle(
  keypoints: Keypoint[],
  joints: [JointName, JointName, JointName],
  minScore = 0.2
): number | null {
  const a = getKeypointByName(keypoints, joints[0], minScore);
  const b = getKeypointByName(keypoints, joints[1], minScore);
  const c = getKeypointByName(keypoints, joints[2], minScore);
  if (!a || !b || !c) return null;
  return calculateAngle(a, b, c);
}

/** Euclidean distance between two keypoints. */
export function keypointDistance(a: Keypoint, b: Keypoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Check if enough keypoints are visible for scoring. */
export function hasMinimumKeypoints(keypoints: Keypoint[], minScore = 0.1): boolean {
  const visible = keypoints.filter((kp) => kp.score !== undefined && kp.score >= minScore);
  return visible.length >= 5; // Need at least 5 of 17 keypoints for partial body
}

// ── Score Utilities ───────────────────────────────────────

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

/** Map score to a gradient color for smooth transitions. */
export function scoreToGradientColor(scorePercent: number): string {
  const clamped = Math.min(100, Math.max(0, scorePercent));
  if (clamped >= 80) {
    // Green zone: interpolate brightness
    const t = (clamped - 80) / 20;
    const g = Math.round(180 + t * 75);
    return `rgb(34, ${g}, 94)`;
  }
  if (clamped >= 50) {
    // Yellow zone: green → yellow
    const t = (clamped - 50) / 30;
    const r = Math.round(234 - t * 200);
    const g = Math.round(179 + t * 20);
    return `rgb(${r}, ${g}, 8)`;
  }
  // Red zone
  const t = clamped / 50;
  const g = Math.round(t * 68);
  return `rgb(239, ${g}, 68)`;
}
