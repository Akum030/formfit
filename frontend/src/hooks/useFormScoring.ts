/**
 * useFormScoring — Real-time form scoring based on MoveNet keypoints
 * and exercise angle constraints.
 *
 * Handles: frame scoring, phase detection, rep counting, rep aggregation.
 * Sends events to backend for coaching decisions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Keypoint, ExerciseDefinition, FrameScore, RepScore, PhaseState, RepPhase, JointName,
} from '../types';
import { computeAngle, hasMinimumKeypoints, getKeypointByName } from '../utils/pose';

const VISIBILITY_CONFIDENCE = 0.15;

interface UseFormScoringOptions {
  exercise: ExerciseDefinition | null;
  keypoints: Keypoint[];
  sessionId: string | null;
  isActive: boolean;
}

interface UseFormScoringResult {
  frameScore: FrameScore | null;
  repScores: RepScore[];
  repCount: number;
  setNumber: number;
  phase: RepPhase;
  avgSessionScore: number;
  currentIssues: string[];
  incrementSet: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useFormScoring({
  exercise,
  keypoints,
  sessionId,
  isActive,
}: UseFormScoringOptions): UseFormScoringResult {
  const [frameScore, setFrameScore] = useState<FrameScore | null>(null);
  const [repScores, setRepScores] = useState<RepScore[]>([]);
  const [phase, setPhase] = useState<RepPhase>('top');
  const [setNumber, setSetNumber] = useState(1);

  const phaseStateRef = useRef<PhaseState>({
    current: 'top',
    angle: 180,
    repCount: 0,
    wasAtBottom: false,
  });
  const frameScoresForRep = useRef<number[]>([]);
  const issuesForRep = useRef<string[]>([]);
  const lastEventTime = useRef(0);

  // Reset when exercise changes
  useEffect(() => {
    phaseStateRef.current = { current: 'top', angle: 180, repCount: 0, wasAtBottom: false };
    frameScoresForRep.current = [];
    issuesForRep.current = [];
    setRepScores([]);
    setFrameScore(null);
    setPhase('top');
    setSetNumber(1);
  }, [exercise?.id]);

  // Score each frame
  useEffect(() => {
    if (!exercise || !isActive || keypoints.length === 0) return;
    if (!hasMinimumKeypoints(keypoints, VISIBILITY_CONFIDENCE)) {
      setFrameScore({ score: 0, scorePercent: 0, issues: ['Not enough of your body is visible'], phase: phaseStateRef.current.current });
      return;
    }

    // Check that the exercise-critical joints are visible
    const missingJoints = checkExerciseJointsVisible(keypoints, exercise);
    if (missingJoints.length > 0) {
      setFrameScore({
        score: 0,
        scorePercent: 0,
        issues: [`Can't see your ${missingJoints.join(', ')} — step back so your full body is in frame`],
        phase: phaseStateRef.current.current,
      });
      return;
    }

    // Phase detection
    const prevState = phaseStateRef.current;
    const newState = updatePhaseState(keypoints, exercise, prevState);
    phaseStateRef.current = newState;
    setPhase(newState.current);

    // Frame scoring
    const fs = scoreCurrentFrame(keypoints, exercise, newState.current);
    setFrameScore(fs);
    frameScoresForRep.current.push(fs.scorePercent);
    issuesForRep.current.push(...fs.issues);

    // Rep completed?
    if (newState.repCount > prevState.repCount) {
      const scores = frameScoresForRep.current;
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const min = scores.length > 0 ? Math.min(...scores) : 0;
      const issues = [...new Set(issuesForRep.current)];

      // Only count the rep if form quality is above minimum threshold (40%)
      if (avg < 40) {
        // Bad form — reject the rep, reset phase but don't increment count
        phaseStateRef.current = { ...newState, repCount: prevState.repCount, wasAtBottom: false };
        frameScoresForRep.current = [];
        issuesForRep.current = [];
        return;
      }

      const repScore: RepScore = {
        repNumber: newState.repCount,
        avgScore: avg,
        minScore: min,
        issues,
      };

      setRepScores((prev) => [...prev, repScore]);
      frameScoresForRep.current = [];
      issuesForRep.current = [];

      // Notify backend
      if (sessionId) {
        sendRepEvent(sessionId, newState.repCount, avg);
      }
    }

    // Send pose event to backend periodically (every 2 seconds)
    const now = Date.now();
    if (sessionId && now - lastEventTime.current > 2000) {
      lastEventTime.current = now;
      sendPoseEvent(sessionId, fs.scorePercent, fs.issues);
    }
  }, [exercise, keypoints, isActive, sessionId]);

  const incrementSet = useCallback(() => {
    setSetNumber((s) => s + 1);
    phaseStateRef.current = { current: 'top', angle: 180, repCount: 0, wasAtBottom: false };
    frameScoresForRep.current = [];
    issuesForRep.current = [];
    setRepScores([]);
    setFrameScore(null);
  }, []);

  const repCount = phaseStateRef.current.repCount;
  const avgSessionScore = repScores.length > 0
    ? Math.round(repScores.reduce((a, b) => a + b.avgScore, 0) / repScores.length)
    : frameScore?.scorePercent ?? 0;

  return {
    frameScore,
    repScores,
    repCount,
    setNumber,
    phase,
    avgSessionScore,
    currentIssues: frameScore?.issues ?? [],
    incrementSet,
  };
}

// ── Internal helpers ──────────────────────────────────────

/**
 * Check if the exercise-critical joints are visible in the frame.
 * Returns list of missing joint group names (e.g. ['knees', 'ankles']).
 */
function checkExerciseJointsVisible(
  keypoints: Keypoint[],
  exercise: ExerciseDefinition
): string[] {
  const missing: string[] = [];

  // Group the exercise's primary joints into body part groups
  const jointGroups: Record<string, JointName[]> = {};
  for (const joint of exercise.primaryJoints) {
    // Extract body part name: "left_knee" → "knees", "left_hip" → "hips"
    const part = joint.replace(/^(left|right)_/, '');
    const plural = part.endsWith('e') ? part + 's' : part + 's';
    if (!jointGroups[plural]) jointGroups[plural] = [];
    jointGroups[plural].push(joint);
  }

  for (const [groupName, joints] of Object.entries(jointGroups)) {
    // At least one joint from this group must be visible
    const anyVisible = joints.some((j) => getKeypointByName(keypoints, j, VISIBILITY_CONFIDENCE) !== null);
    if (!anyVisible) {
      missing.push(groupName);
    }
  }

  return missing;
}

function updatePhaseState(
  keypoints: Keypoint[],
  exercise: ExerciseDefinition,
  state: PhaseState
): PhaseState {
  const { primaryAngle, bottomThreshold, topThreshold } = exercise.phaseDetection;
  // Try left side first, then right side if left isn't visible
  let angle = computeAngle(keypoints, primaryAngle, VISIBILITY_CONFIDENCE);
  if (angle === null) {
    const rightAngle = primaryAngle.map(j => j.replace('left_', 'right_')) as [JointName, JointName, JointName];
    angle = computeAngle(keypoints, rightAngle, VISIBILITY_CONFIDENCE);
  }
  if (angle === null) return state;

  const newState = { ...state, angle };
  const isCurl = exercise.pattern === 'curl';

  if (isCurl) {
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

function scoreConstraints(
  keypoints: Keypoint[],
  constraints: ReturnType<typeof selectBestSideConstraints>,
  margin: number
): { weightedScore: number; totalWeight: number; issues: string[] } {
  let totalWeight = 0;
  let weightedScore = 0;
  const issues: string[] = [];

  for (const constraint of constraints) {
    const angle = computeAngle(keypoints, constraint.joints, VISIBILITY_CONFIDENCE);
    if (angle === null) continue;

    let score: number;
    if (angle >= constraint.min && angle <= constraint.max) {
      score = 1.0;
    } else {
      const diff = angle < constraint.min
        ? constraint.min - angle
        : angle - constraint.max;
      score = Math.max(0, 1 - diff / margin);
    }

    weightedScore += score * constraint.weight;
    totalWeight += constraint.weight;

    if (score < 0.6) {
      issues.push(constraint.issueText);
    }
  }

  return { weightedScore, totalWeight, issues };
}

function scoreCurrentFrame(
  keypoints: Keypoint[],
  exercise: ExerciseDefinition,
  currentPhase: RepPhase
): FrameScore {
  const phaseConstraints = exercise.angleConstraints.filter((c) => c.phase === currentPhase);

  // During transition phases (eccentric/concentric), score against target phase with generous tolerance
  if (phaseConstraints.length === 0) {
    const targetPhase = currentPhase === 'eccentric' ? 'bottom' : 'top';
    const targetConstraints = exercise.angleConstraints.filter((c) => c.phase === targetPhase);
    if (targetConstraints.length > 0) {
      const effectiveConstraints = selectBestSideConstraints(keypoints, targetConstraints);
      const { weightedScore, totalWeight, issues } = scoreConstraints(keypoints, effectiveConstraints, 45);
      if (totalWeight === 0) {
        return { score: 0.6, scorePercent: 60, issues: [], phase: currentPhase };
      }
      // Floor at 35% during transitions - still credit for motion but not too generous
      const rawScore = weightedScore / totalWeight;
      const adjustedScore = Math.max(0.35, rawScore);
      return {
        score: adjustedScore,
        scorePercent: Math.round(adjustedScore * 100),
        issues: [],
        phase: currentPhase,
      };
    }
    return { score: 0.7, scorePercent: 70, issues: [], phase: currentPhase };
  }

  // Normal phase scoring (top/bottom) — strict margin for accurate form detection
  const effectiveConstraints = selectBestSideConstraints(keypoints, phaseConstraints);
  const { weightedScore, totalWeight, issues } = scoreConstraints(keypoints, effectiveConstraints, 35);

  if (totalWeight === 0) {
    return {
      score: 0,
      scorePercent: 0,
      issues: ['Position yourself so the camera can see the relevant body parts'],
      phase: currentPhase,
    };
  }

  const finalScore = weightedScore / totalWeight;
  return {
    score: finalScore,
    scorePercent: Math.round(finalScore * 100),
    issues: [...new Set(issues)],
    phase: currentPhase,
  };
}

/**
 * For mirrored left/right constraint pairs, pick the side that's more visible.
 * This handles exercises viewed from the side where only one limb set is visible.
 */
function selectBestSideConstraints(
  keypoints: Keypoint[],
  constraints: readonly { joints: [JointName, JointName, JointName]; min: number; max: number; phase: RepPhase; weight: number; issueText: string }[]
): typeof constraints {
  // Group constraints by their "neutralized" joint key (remove left/right prefix)
  const groups = new Map<string, typeof constraints[number][]>();
  const standalone: typeof constraints[number][] = [];

  for (const c of constraints) {
    const neutralKey = c.joints.map(j => j.replace(/^(left|right)_/, '')).join('-');
    const hasLeftRight = c.joints.some(j => j.startsWith('left_') || j.startsWith('right_'));
    if (!hasLeftRight) {
      standalone.push(c);
      continue;
    }
    if (!groups.has(neutralKey)) groups.set(neutralKey, []);
    groups.get(neutralKey)!.push(c);
  }

  const result: typeof constraints[number][] = [...standalone];

  for (const group of groups.values()) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }

    // Score visibility for each variant in the group
    let bestConstraint = group[0];
    let bestVisibility = -1;

    for (const c of group) {
      let vis = 0;
      for (const j of c.joints) {
        const kp = getKeypointByName(keypoints, j, VISIBILITY_CONFIDENCE);
        if (kp && kp.score !== undefined) vis += kp.score;
      }
      if (vis > bestVisibility) {
        bestVisibility = vis;
        bestConstraint = c;
      }
    }

    // Use the best-visible side but with combined weight
    const totalWeight = group.reduce((s, c) => s + c.weight, 0);
    result.push({ ...bestConstraint, weight: totalWeight });
  }

  return result;
}

async function sendPoseEvent(sessionId: string, score: number, issues: string[]) {
  try {
    await fetch(`${API_BASE}/api/events/pose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, score, issues }),
    });
  } catch {
    // Silently fail — non-critical
  }
}

async function sendRepEvent(sessionId: string, repCount: number, repScore: number) {
  try {
    await fetch(`${API_BASE}/api/events/rep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, repCount, repScore }),
    });
  } catch {
    // Silently fail — non-critical
  }
}
