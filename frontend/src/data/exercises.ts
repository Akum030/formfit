/**
 * Exercise definitions for the frontend - mirrors backend definitions.
 * Imported by useFormScoring for client-side scoring.
 */

import type { ExerciseDefinition } from '../types';

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'squat',
    name: 'Squat',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 130,
      topThreshold: 150,
    },
    pattern: 'squat',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 60, max: 140, phase: 'bottom', weight: 0.3, issueText: 'Adjust knee bend - aim for around 90 degrees' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 60, max: 140, phase: 'bottom', weight: 0.3, issueText: 'Adjust knee bend - aim for around 90 degrees' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 40, max: 140, phase: 'bottom', weight: 0.2, issueText: 'Keep chest up' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 140, max: 180, phase: 'top', weight: 0.1, issueText: 'Stand up fully' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 140, max: 180, phase: 'top', weight: 0.1, issueText: 'Stand up fully' },
    ],
  },
  {
    id: 'pushup',
    name: 'Push-up',
    category: 'Chest',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'right_shoulder', 'right_elbow', 'right_wrist', 'left_hip', 'left_ankle', 'right_hip', 'right_ankle'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 120,
      topThreshold: 140,
    },
    pattern: 'horizontal_push',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 40, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Bend arms more at the bottom' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 40, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Bend arms more at the bottom' },
      { joints: ['left_shoulder', 'left_hip', 'left_ankle'], min: 120, max: 180, phase: 'bottom', weight: 0.15, issueText: 'Keep body straight' },
      { joints: ['right_shoulder', 'right_hip', 'right_ankle'], min: 120, max: 180, phase: 'bottom', weight: 0.1, issueText: 'Keep body straight' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 130, max: 180, phase: 'top', weight: 0.1, issueText: 'Extend arms at the top' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 130, max: 180, phase: 'top', weight: 0.1, issueText: 'Extend arms at the top' },
      { joints: ['left_shoulder', 'left_hip', 'left_ankle'], min: 130, max: 180, phase: 'top', weight: 0.05, issueText: 'Keep body straight at the top' },
    ],
  },
  {
    id: 'lunge',
    name: 'Lunge',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 130,
      topThreshold: 145,
    },
    pattern: 'lunge',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 60, max: 135, phase: 'bottom', weight: 0.35, issueText: 'Front knee should be at around 90 degrees' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 40, max: 140, phase: 'bottom', weight: 0.25, issueText: 'Keep torso upright' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 50, max: 140, phase: 'bottom', weight: 0.2, issueText: 'Lower back knee' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 135, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully between reps' },
    ],
  },
  {
    id: 'bicep_curl',
    name: 'Bicep Curl',
    category: 'Arms',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 70,
      topThreshold: 120,
    },
    pattern: 'curl',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 20, max: 80, phase: 'bottom', weight: 0.3, issueText: 'Curl up more - squeeze at the top' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 20, max: 80, phase: 'bottom', weight: 0.3, issueText: 'Curl up more - squeeze at the top' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 110, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 110, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully' },
    ],
  },
  {
    id: 'shoulder_press',
    name: 'Shoulder Press',
    category: 'Shoulders',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 120,
      topThreshold: 145,
    },
    pattern: 'vertical_push',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 50, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Lower weights to shoulder level' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 50, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Lower weights to shoulder level' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 135, max: 180, phase: 'top', weight: 0.25, issueText: 'Press all the way up' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 135, max: 180, phase: 'top', weight: 0.25, issueText: 'Press all the way up' },
    ],
  },

  // ── JUMPING JACKS ─────────────────────────────────────────
  {
    id: 'jumping_jacks',
    name: 'Jumping Jacks',
    category: 'Cardio',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee', 'right_shoulder', 'right_hip'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_shoulder', 'left_elbow'],
      bottomThreshold: 80,
      topThreshold: 140,
    },
    pattern: 'jumping',
    defaultSets: 3,
    defaultReps: 20,
    restSeconds: 30,
    angleConstraints: [
      { joints: ['left_hip', 'left_shoulder', 'left_elbow'], min: 130, max: 180, phase: 'top', weight: 0.3, issueText: 'Raise arms fully overhead' },
      { joints: ['right_hip', 'right_shoulder', 'right_elbow'], min: 130, max: 180, phase: 'top', weight: 0.3, issueText: 'Raise arms fully overhead' },
      { joints: ['left_hip', 'left_shoulder', 'left_elbow'], min: 10, max: 80, phase: 'bottom', weight: 0.2, issueText: 'Bring arms down to sides' },
      { joints: ['right_hip', 'right_shoulder', 'right_elbow'], min: 10, max: 80, phase: 'bottom', weight: 0.2, issueText: 'Bring arms down to sides' },
    ],
  },

  // ── HIGH KNEES ────────────────────────────────────────────
  {
    id: 'high_knees',
    name: 'High Knees',
    category: 'Cardio',
    primaryJoints: ['left_hip', 'left_knee', 'right_hip', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 100,
      topThreshold: 150,
    },
    pattern: 'jumping',
    defaultSets: 3,
    defaultReps: 20,
    restSeconds: 30,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Bring knee higher — aim for hip level' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 60, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Bring knee higher — aim for hip level' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 140, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand tall between reps' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 140, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand tall between reps' },
    ],
  },

  // ── GLUTE BRIDGE ──────────────────────────────────────────
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    category: 'Glutes',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee', 'right_hip', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 100,
      topThreshold: 150,
    },
    pattern: 'glute_bridge',
    defaultSets: 3,
    defaultReps: 15,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 140, max: 180, phase: 'top', weight: 0.3, issueText: 'Push hips up higher — squeeze glutes' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 140, max: 180, phase: 'top', weight: 0.3, issueText: 'Push hips up higher — squeeze glutes' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 110, phase: 'bottom', weight: 0.2, issueText: 'Keep knees bent at ~90 degrees' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 70, max: 110, phase: 'bottom', weight: 0.2, issueText: 'Keep knees bent at ~90 degrees' },
    ],
  },

  // ── CALF RAISE ────────────────────────────────────────────
  {
    id: 'calf_raise',
    name: 'Calf Raise',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_knee', 'right_ankle'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 160,
      topThreshold: 172,
    },
    pattern: 'calf_raise',
    defaultSets: 3,
    defaultReps: 15,
    restSeconds: 30,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 168, max: 180, phase: 'top', weight: 0.3, issueText: 'Rise up on your toes fully' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 168, max: 180, phase: 'top', weight: 0.3, issueText: 'Rise up on your toes fully' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 170, phase: 'bottom', weight: 0.2, issueText: 'Lower heels fully' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 150, max: 170, phase: 'bottom', weight: 0.2, issueText: 'Lower heels fully' },
    ],
  },

  // ── TRICEP DIP ────────────────────────────────────────────
  {
    id: 'tricep_dip',
    name: 'Tricep Dip',
    category: 'Arms',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'right_shoulder', 'right_elbow'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 150,
    },
    pattern: 'tricep_extension',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 60, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Lower until elbows at 90 degrees' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 60, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Lower until elbows at 90 degrees' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully at top' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully at top' },
    ],
  },

  // ── LATERAL RAISE (Dumbbell) ──────────────────────────────
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    category: 'Shoulders',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_hip', 'right_shoulder', 'right_elbow'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_shoulder', 'left_elbow'],
      bottomThreshold: 40,
      topThreshold: 75,
    },
    pattern: 'lateral_raise',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_hip', 'left_shoulder', 'left_elbow'], min: 70, max: 110, phase: 'top', weight: 0.3, issueText: 'Raise arms to shoulder height' },
      { joints: ['right_hip', 'right_shoulder', 'right_elbow'], min: 70, max: 110, phase: 'top', weight: 0.3, issueText: 'Raise arms to shoulder height' },
      { joints: ['left_hip', 'left_shoulder', 'left_elbow'], min: 5, max: 40, phase: 'bottom', weight: 0.2, issueText: 'Lower arms to sides' },
      { joints: ['right_hip', 'right_shoulder', 'right_elbow'], min: 5, max: 40, phase: 'bottom', weight: 0.2, issueText: 'Lower arms to sides' },
    ],
  },

  // ── FRONT RAISE (Dumbbell) ────────────────────────────────
  {
    id: 'front_raise',
    name: 'Front Raise',
    category: 'Shoulders',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_hip', 'right_shoulder'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_shoulder', 'left_elbow'],
      bottomThreshold: 40,
      topThreshold: 75,
    },
    pattern: 'lateral_raise',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_hip', 'left_shoulder', 'left_elbow'], min: 70, max: 110, phase: 'top', weight: 0.3, issueText: 'Raise arms to shoulder height in front' },
      { joints: ['right_hip', 'right_shoulder', 'right_elbow'], min: 70, max: 110, phase: 'top', weight: 0.3, issueText: 'Raise arms to shoulder height in front' },
      { joints: ['left_hip', 'left_shoulder', 'left_elbow'], min: 5, max: 40, phase: 'bottom', weight: 0.2, issueText: 'Lower arms fully' },
      { joints: ['right_hip', 'right_shoulder', 'right_elbow'], min: 5, max: 40, phase: 'bottom', weight: 0.2, issueText: 'Lower arms fully' },
    ],
  },

  // ── DUMBBELL ROW ──────────────────────────────────────────
  {
    id: 'dumbbell_row',
    name: 'Dumbbell Row',
    category: 'Back',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 80,
      topThreshold: 130,
    },
    pattern: 'row',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 40, max: 90, phase: 'bottom', weight: 0.3, issueText: 'Pull elbow back further — squeeze shoulder blade' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 40, max: 90, phase: 'bottom', weight: 0.3, issueText: 'Pull elbow back further — squeeze shoulder blade' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 120, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arm fully at bottom' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 120, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arm fully at bottom' },
    ],
  },

  // ── HAMMER CURL (Dumbbell) ────────────────────────────────
  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    category: 'Arms',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 50,
      topThreshold: 140,
    },
    pattern: 'curl',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 25, max: 60, phase: 'bottom', weight: 0.3, issueText: 'Curl up more — keep palms facing in' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 25, max: 60, phase: 'bottom', weight: 0.3, issueText: 'Curl up more — keep palms facing in' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully' },
    ],
  },

  // ── DEADLIFT (Dumbbell) ───────────────────────────────────
  {
    id: 'deadlift',
    name: 'Deadlift',
    category: 'Back',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 100,
      topThreshold: 155,
    },
    pattern: 'hip_hinge',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 90,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Hinge at hips more — keep back flat' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 140, max: 180, phase: 'bottom', weight: 0.25, issueText: 'Keep legs mostly straight — slight knee bend' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully — squeeze glutes at top' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully — squeeze glutes at top' },
    ],
  },

  // ── GOBLET SQUAT (Dumbbell) ───────────────────────────────
  {
    id: 'goblet_squat',
    name: 'Goblet Squat',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 110,
      topThreshold: 160,
    },
    pattern: 'squat',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 120, phase: 'bottom', weight: 0.25, issueText: 'Squat deeper — aim for 90 degrees' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 70, max: 120, phase: 'bottom', weight: 0.25, issueText: 'Squat deeper — aim for 90 degrees' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 55, max: 120, phase: 'bottom', weight: 0.2, issueText: 'Keep chest up — hold weight close' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 155, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand up fully' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 155, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand up fully' },
    ],
  },

  // ── OVERHEAD TRICEP EXTENSION ─────────────────────────────
  {
    id: 'overhead_tricep',
    name: 'Overhead Tricep Extension',
    category: 'Arms',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 70,
      topThreshold: 140,
    },
    pattern: 'tricep_extension',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 30, max: 80, phase: 'bottom', weight: 0.3, issueText: 'Lower weight behind head more' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 30, max: 80, phase: 'bottom', weight: 0.3, issueText: 'Lower weight behind head more' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully overhead' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully overhead' },
    ],
  },

  // ── WALL SIT (Isometric) ──────────────────────────────────
  {
    id: 'wall_sit',
    name: 'Wall Sit',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'left_shoulder'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 100,
      topThreshold: 150,
    },
    pattern: 'squat',
    defaultSets: 3,
    defaultReps: 1,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 75, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Keep thighs parallel to floor — 90 degree knee angle' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 75, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Keep thighs parallel to floor — 90 degree knee angle' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 75, max: 110, phase: 'bottom', weight: 0.2, issueText: 'Keep back flat against wall' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up to rest' },
    ],
  },

  // ── SUMO SQUAT ────────────────────────────────────────────
  {
    id: 'sumo_squat',
    name: 'Sumo Squat',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 110,
      topThreshold: 155,
    },
    pattern: 'squat',
    defaultSets: 3,
    defaultReps: 15,
    restSeconds: 45,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 120, phase: 'bottom', weight: 0.25, issueText: 'Go deeper — knees track over toes' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 70, max: 120, phase: 'bottom', weight: 0.25, issueText: 'Go deeper — knees track over toes' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 130, phase: 'bottom', weight: 0.2, issueText: 'Keep torso upright' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand fully' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 150, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand fully' },
    ],
  },

  // ── STANDING CRUNCH ───────────────────────────────────────
  {
    id: 'standing_crunch',
    name: 'Standing Crunch',
    category: 'Core',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 100,
      topThreshold: 155,
    },
    pattern: 'crunch',
    defaultSets: 3,
    defaultReps: 15,
    restSeconds: 30,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Crunch deeper — bring elbow to knee' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 60, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Crunch deeper — bring elbow to knee' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 150, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand tall between reps' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 150, max: 180, phase: 'top', weight: 0.15, issueText: 'Stand tall between reps' },
    ],
  },

  // ── STANDING LEG RAISE ────────────────────────────────────
  {
    id: 'leg_raise',
    name: 'Standing Leg Raise',
    category: 'Core',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 110,
      topThreshold: 160,
    },
    pattern: 'leg_raise',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 30,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 120, phase: 'bottom', weight: 0.35, issueText: 'Raise leg higher — keep it straight' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'bottom', weight: 0.25, issueText: 'Keep raised leg straight' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand tall between reps' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Keep standing leg straight' },
    ],
  },
];

export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id);
}
