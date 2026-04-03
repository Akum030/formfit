/**
 * useGeminiAnalysis — Periodically sends keypoint angles to Gemini
 * for AI-powered form analysis that goes beyond simple angle thresholds.
 *
 * Returns the latest AI analysis result which can overlay/blend with
 * the local angle-based scoring.
 *
 * Auth resilience: Tracks consecutive failures and stops retrying after
 * 3 failures (likely invalid API key) to prevent wasted network calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Keypoint, ExerciseDefinition, RepPhase, JointName } from '../types';
import { computeAngle, getKeypointByName, JOINT_INDEX } from '../utils/pose';

export interface GeminiAnalysis {
  score: number;
  phase: string;
  issues: string[];
  tip: string;
  repCompleted: boolean;
}

interface UseGeminiAnalysisOptions {
  exercise: ExerciseDefinition | null;
  keypoints: Keypoint[];
  sessionId: string | null;
  currentPhase: RepPhase;
  repCount: number;
  isActive: boolean;
}

interface UseGeminiAnalysisResult {
  aiAnalysis: GeminiAnalysis | null;
  aiScore: number | null;
  aiTip: string;
  isAnalyzing: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const ANALYSIS_INTERVAL_MS = 5000;
// Stop calling API after this many consecutive failures (likely auth error)
const MAX_CONSECUTIVE_FAILURES = 3;

export function useGeminiAnalysis({
  exercise,
  keypoints,
  sessionId,
  currentPhase,
  repCount,
  isActive,
}: UseGeminiAnalysisOptions): UseGeminiAnalysisResult {
  const [aiAnalysis, setAiAnalysis] = useState<GeminiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastAnalysisTime = useRef(0);
  const previousAnalysis = useRef<GeminiAnalysis | null>(null);
  /** Tracks consecutive API failures to detect auth issues */
  const consecutiveFailures = useRef(0);

  const computeAllAngles = useCallback(
    (kps: Keypoint[]): Record<string, number> => {
      if (!exercise) return {};
      const angles: Record<string, number> = {};

      // Compute angles for all exercise constraints
      const seenTriplets = new Set<string>();
      for (const constraint of exercise.angleConstraints) {
        const key = constraint.joints.join('-');
        if (seenTriplets.has(key)) continue;
        seenTriplets.add(key);

        const angle = computeAngle(kps, constraint.joints);
        if (angle !== null) {
          // Name it by the middle joint (the vertex)
          angles[constraint.joints[1]] = angle;
        }
      }

      // Also compute common useful angles not in constraints
      const extraTriplets: [JointName, JointName, JointName][] = [
        ['left_shoulder', 'left_hip', 'left_knee'],
        ['right_shoulder', 'right_hip', 'right_knee'],
        ['left_hip', 'left_knee', 'left_ankle'],
        ['right_hip', 'right_knee', 'right_ankle'],
        ['left_shoulder', 'left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow', 'right_wrist'],
      ];
      for (const triplet of extraTriplets) {
        const key = triplet.join('-');
        if (seenTriplets.has(key)) continue;
        seenTriplets.add(key);
        const angle = computeAngle(kps, triplet);
        if (angle !== null) {
          angles[triplet[1]] = angle;
        }
      }

      return angles;
    },
    [exercise],
  );

  const computeKeypointPositions = useCallback(
    (kps: Keypoint[]): Record<string, { x: number; y: number; score: number }> => {
      const positions: Record<string, { x: number; y: number; score: number }> = {};
      const jointNames = Object.keys(JOINT_INDEX) as JointName[];
      for (const name of jointNames) {
        const kp = getKeypointByName(kps, name, 0.2);
        if (kp) {
          positions[name] = { x: kp.x, y: kp.y, score: kp.score ?? 0 };
        }
      }
      return positions;
    },
    [],
  );

  useEffect(() => {
    if (!exercise || !isActive || !sessionId || keypoints.length === 0) return;

    // Skip API calls for local/offline sessions — no backend to call
    if (sessionId.startsWith('local-')) return;

    // Stop calling if API consistently fails (likely invalid key)
    if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) return;

    const now = Date.now();
    if (now - lastAnalysisTime.current < ANALYSIS_INTERVAL_MS) return;
    lastAnalysisTime.current = now;

    const angles = computeAllAngles(keypoints);
    if (Object.keys(angles).length < 2) return; // Not enough data

    const keypointPositions = computeKeypointPositions(keypoints);

    setIsAnalyzing(true);

    fetch(`${API_BASE}/api/events/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        exerciseName: exercise.name,
        exerciseId: exercise.id,
        angles,
        keypointPositions,
        currentPhase,
        repCount,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          // Track non-OK responses (auth errors return 4xx)
          consecutiveFailures.current++;
          if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
            console.warn('[Gemini] Stopping analysis — API returning errors (check API key)');
          }
          return null;
        }
        consecutiveFailures.current = 0; // Reset on success
        return res.json();
      })
      .then((data) => {
        if (data?.analysis) {
          setAiAnalysis(data.analysis);
          previousAnalysis.current = data.analysis;
        }
      })
      .catch(() => {
        consecutiveFailures.current++;
        if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
          console.warn('[Gemini] Stopping analysis — network errors (check backend)');
        }
      })
      .finally(() => {
        setIsAnalyzing(false);
      });
  }, [exercise, keypoints, sessionId, isActive, currentPhase, repCount, computeAllAngles, computeKeypointPositions]);

  // Reset when exercise changes
  useEffect(() => {
    setAiAnalysis(null);
    previousAnalysis.current = null;
    consecutiveFailures.current = 0; // Give the API another chance with new exercise
  }, [exercise?.id]);

  // Reset failure counter when session changes (new coaching session = fresh start)
  useEffect(() => {
    consecutiveFailures.current = 0;
  }, [sessionId]);

  return {
    aiAnalysis,
    aiScore: aiAnalysis?.score ?? null,
    aiTip: aiAnalysis?.tip ?? '',
    isAnalyzing,
  };
}
