/**
 * Exercise Definitions — Ground truth for form scoring, derived from
 * biomechanics research and open-source exercise tracking repos.
 *
 * Reference concepts:
 *  - ai-workout-assistant: MoveNet + DNN + JSON rules for rep counting
 *  - Exercise_tracking: MoveNet + dense NN for classification
 *  - AI-Personal-Trainer: MediaPipe + posture correction
 *  - Exercise-Correction: bicep curl, plank, squat, lunge classification
 *  - Papers on squat analysis and form correction
 */

export type JointName =
  | 'nose'
  | 'left_eye' | 'right_eye'
  | 'left_ear' | 'right_ear'
  | 'left_shoulder' | 'right_shoulder'
  | 'left_elbow' | 'right_elbow'
  | 'left_wrist' | 'right_wrist'
  | 'left_hip' | 'right_hip'
  | 'left_knee' | 'right_knee'
  | 'left_ankle' | 'right_ankle';

/** MoveNet keypoint index → joint name */
export const JOINT_INDEX: Record<number, JointName> = {
  0: 'nose',
  1: 'left_eye', 2: 'right_eye',
  3: 'left_ear', 4: 'right_ear',
  5: 'left_shoulder', 6: 'right_shoulder',
  7: 'left_elbow', 8: 'right_elbow',
  9: 'left_wrist', 10: 'right_wrist',
  11: 'left_hip', 12: 'right_hip',
  13: 'left_knee', 14: 'right_knee',
  15: 'left_ankle', 16: 'right_ankle',
};

export const JOINT_NAME_TO_INDEX: Record<JointName, number> = Object.fromEntries(
  Object.entries(JOINT_INDEX).map(([k, v]) => [v, Number(k)])
) as Record<JointName, number>;

export type RepPhase = 'eccentric' | 'concentric' | 'bottom' | 'top';

export interface AngleConstraint {
  /** Triplet of joints — angle is measured at the MIDDLE joint */
  joints: [JointName, JointName, JointName];
  /** Minimum acceptable angle (degrees) */
  min: number;
  /** Maximum acceptable angle (degrees) */
  max: number;
  /** Which phase of the rep this applies to */
  phase: RepPhase;
  /** Importance weight for scoring (0-1, sum to ~1 per phase) */
  weight: number;
  /** Human-readable issue when violated */
  issueText: string;
}

export type MovementPattern =
  | 'squat'
  | 'hip_hinge'
  | 'vertical_push'
  | 'horizontal_push'
  | 'lunge'
  | 'curl'
  | 'plank_hold';

export interface PhaseDetection {
  /** Joint triplet whose angle is tracked for phase detection */
  primaryAngle: [JointName, JointName, JointName];
  /** Angle threshold below which we consider "bottom" */
  bottomThreshold: number;
  /** Angle threshold above which we consider "top" */
  topThreshold: number;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: string;
  primaryJoints: JointName[];
  angleConstraints: AngleConstraint[];
  phaseDetection: PhaseDetection;
  pattern: MovementPattern;
  defaultSets: number;
  defaultReps: number;
  restSeconds: number;
}

// ────────────────────────────────────────────────────────────
// EXERCISE LIBRARY
// ────────────────────────────────────────────────────────────

export const EXERCISES: ExerciseDefinition[] = [
  // ── SQUAT ──────────────────────────────────────────────────
  {
    id: 'squat',
    name: 'Squat',
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
      // Knee angle at bottom — should be 70-110°
      {
        joints: ['left_hip', 'left_knee', 'left_ankle'],
        min: 70, max: 120,
        phase: 'bottom',
        weight: 0.3,
        issueText: 'Knee angle off — go deeper or don\'t over-bend',
      },
      {
        joints: ['right_hip', 'right_knee', 'right_ankle'],
        min: 70, max: 120,
        phase: 'bottom',
        weight: 0.3,
        issueText: 'Knee angle off — go deeper or don\'t over-bend',
      },
      // Torso lean — shoulder-hip-knee angle should stay > 55°
      {
        joints: ['left_shoulder', 'left_hip', 'left_knee'],
        min: 55, max: 120,
        phase: 'bottom',
        weight: 0.2,
        issueText: 'Leaning too far forward — keep chest up',
      },
      // At top — knees should be mostly straight
      {
        joints: ['left_hip', 'left_knee', 'left_ankle'],
        min: 155, max: 180,
        phase: 'top',
        weight: 0.1,
        issueText: 'Stand up fully at the top',
      },
      {
        joints: ['right_hip', 'right_knee', 'right_ankle'],
        min: 155, max: 180,
        phase: 'top',
        weight: 0.1,
        issueText: 'Stand up fully at the top',
      },
    ],
  },

  // ── PUSHUP ─────────────────────────────────────────────────
  {
    id: 'pushup',
    name: 'Push-up',
    category: 'Chest',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip', 'left_ankle'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 155,
    },
    pattern: 'horizontal_push',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      // Elbow angle at bottom
      {
        joints: ['left_shoulder', 'left_elbow', 'left_wrist'],
        min: 60, max: 110,
        phase: 'bottom',
        weight: 0.3,
        issueText: 'Go deeper — chest should nearly touch floor',
      },
      {
        joints: ['right_shoulder', 'right_elbow', 'right_wrist'],
        min: 60, max: 110,
        phase: 'bottom',
        weight: 0.3,
        issueText: 'Go deeper — chest should nearly touch floor',
      },
      // Body line — shoulder-hip-ankle should be ~straight
      {
        joints: ['left_shoulder', 'left_hip', 'left_ankle'],
        min: 155, max: 180,
        phase: 'bottom',
        weight: 0.2,
        issueText: 'Keep body straight — don\'t sag or pike hips',
      },
      // Elbow at top
      {
        joints: ['left_shoulder', 'left_elbow', 'left_wrist'],
        min: 155, max: 180,
        phase: 'top',
        weight: 0.1,
        issueText: 'Fully extend arms at the top',
      },
      {
        joints: ['right_shoulder', 'right_elbow', 'right_wrist'],
        min: 155, max: 180,
        phase: 'top',
        weight: 0.1,
        issueText: 'Fully extend arms at the top',
      },
    ],
  },

  // ── LUNGE ──────────────────────────────────────────────────
  {
    id: 'lunge',
    name: 'Lunge',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 110,
      topThreshold: 155,
    },
    pattern: 'lunge',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      // Front knee at bottom
      {
        joints: ['left_hip', 'left_knee', 'left_ankle'],
        min: 75, max: 110,
        phase: 'bottom',
        weight: 0.35,
        issueText: 'Front knee should be at ~90° at the bottom',
      },
      // Torso upright
      {
        joints: ['left_shoulder', 'left_hip', 'left_knee'],
        min: 60, max: 130,
        phase: 'bottom',
        weight: 0.25,
        issueText: 'Keep torso upright — don\'t lean forward',
      },
      // Back knee angle (approximation)
      {
        joints: ['right_hip', 'right_knee', 'right_ankle'],
        min: 70, max: 120,
        phase: 'bottom',
        weight: 0.2,
        issueText: 'Lower back knee closer to the floor',
      },
      // Standing at top
      {
        joints: ['left_hip', 'left_knee', 'left_ankle'],
        min: 150, max: 180,
        phase: 'top',
        weight: 0.2,
        issueText: 'Stand up fully between reps',
      },
    ],
  },

  // ── BICEP CURL ────────────────────────────────────────────
  {
    id: 'bicep_curl',
    name: 'Bicep Curl',
    category: 'Arms',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 50, // fully curled = small angle
      topThreshold: 140,   // extended = large angle
    },
    pattern: 'curl',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 45,
    angleConstraints: [
      // Elbow angle at contracted position
      {
        joints: ['left_shoulder', 'left_elbow', 'left_wrist'],
        min: 25, max: 60,
        phase: 'bottom',
        weight: 0.3,
        issueText: 'Curl all the way up — squeeze at the top',
      },
      {
        joints: ['right_shoulder', 'right_elbow', 'right_wrist'],
        min: 25, max: 60,
        phase: 'bottom',
        weight: 0.3,
        issueText: 'Curl all the way up — squeeze at the top',
      },
      // Full extension
      {
        joints: ['left_shoulder', 'left_elbow', 'left_wrist'],
        min: 140, max: 180,
        phase: 'top',
        weight: 0.2,
        issueText: 'Extend arms fully at the bottom',
      },
      {
        joints: ['right_shoulder', 'right_elbow', 'right_wrist'],
        min: 140, max: 180,
        phase: 'top',
        weight: 0.2,
        issueText: 'Extend arms fully at the bottom',
      },
    ],
  },

  // ── SHOULDER PRESS ────────────────────────────────────────
  {
    id: 'shoulder_press',
    name: 'Shoulder Press',
    category: 'Shoulders',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 160,
    },
    pattern: 'vertical_push',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      // Elbow at bottom
      {
        joints: ['left_shoulder', 'left_elbow', 'left_wrist'],
        min: 70, max: 110,
        phase: 'bottom',
        weight: 0.25,
        issueText: 'Lower weights to shoulder level',
      },
      {
        joints: ['right_shoulder', 'right_elbow', 'right_wrist'],
        min: 70, max: 110,
        phase: 'bottom',
        weight: 0.25,
        issueText: 'Lower weights to shoulder level',
      },
      // Full extension at top
      {
        joints: ['left_shoulder', 'left_elbow', 'left_wrist'],
        min: 155, max: 180,
        phase: 'top',
        weight: 0.25,
        issueText: 'Press all the way up — full arm extension',
      },
      {
        joints: ['right_shoulder', 'right_elbow', 'right_wrist'],
        min: 155, max: 180,
        phase: 'top',
        weight: 0.25,
        issueText: 'Press all the way up — full arm extension',
      },
    ],
  },
];

export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function getExercisesByCategory(category: string): ExerciseDefinition[] {
  return EXERCISES.filter((e) => e.category.toLowerCase() === category.toLowerCase());
}
