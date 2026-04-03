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
  | 'plank_hold'
  | 'lateral_raise'
  | 'row'
  | 'crunch'
  | 'leg_raise'
  | 'calf_raise'
  | 'glute_bridge'
  | 'jumping'
  | 'tricep_extension';

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

  // ── STANDING CRUNCHES ─────────────────────────────────────
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

  // ── REVERSE LUNGE ─────────────────────────────────────────
  {
    id: 'reverse_lunge',
    name: 'Reverse Lunge',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee'],
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
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 75, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Front knee at ~90° — step back further' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Keep torso upright — don\'t lean forward' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 70, max: 120, phase: 'bottom', weight: 0.2, issueText: 'Lower back knee closer to the floor' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'top', weight: 0.25, issueText: 'Stand up fully between reps' },
    ],
  },

  // ── CURTSY LUNGE ──────────────────────────────────────────
  {
    id: 'curtsy_lunge',
    name: 'Curtsy Lunge',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee'],
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
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 75, max: 115, phase: 'bottom', weight: 0.35, issueText: 'Front knee at ~90° — cross back leg behind' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Keep torso upright and core tight' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully between reps' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 150, max: 180, phase: 'top', weight: 0.2, issueText: 'Bring feet together at top' },
    ],
  },

  // ── SIDE LUNGE ────────────────────────────────────────────
  {
    id: 'side_lunge',
    name: 'Side Lunge',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 115,
      topThreshold: 155,
    },
    pattern: 'lunge',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 120, phase: 'bottom', weight: 0.35, issueText: 'Bend the lunging knee deeper — sit back into it' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 55, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Keep chest up and torso upright' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully between reps' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Keep the straight leg extended' },
    ],
  },

  // ── BULGARIAN SPLIT SQUAT ─────────────────────────────────
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 110,
      topThreshold: 155,
    },
    pattern: 'squat',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 115, phase: 'bottom', weight: 0.35, issueText: 'Lower deeper — front thigh parallel to floor' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 130, phase: 'bottom', weight: 0.25, issueText: 'Keep torso upright' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully — drive through front heel' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 40, max: 130, phase: 'bottom', weight: 0.2, issueText: 'Back knee should lower towards floor' },
    ],
  },

  // ── PIKE PUSH-UP ──────────────────────────────────────────
  {
    id: 'pike_pushup',
    name: 'Pike Push-up',
    category: 'Shoulders',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 150,
    },
    pattern: 'vertical_push',
    defaultSets: 3,
    defaultReps: 8,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 60, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Lower head towards floor — bend elbows more' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 60, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Lower head towards floor — bend elbows more' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 145, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully at the top' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 145, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully at the top' },
    ],
  },

  // ── DIAMOND PUSH-UP ───────────────────────────────────────
  {
    id: 'diamond_pushup',
    name: 'Diamond Push-up',
    category: 'Arms',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'right_shoulder', 'right_elbow', 'right_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 145,
    },
    pattern: 'horizontal_push',
    defaultSets: 3,
    defaultReps: 8,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 50, max: 110, phase: 'bottom', weight: 0.25, issueText: 'Lower chest closer to hands' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 50, max: 110, phase: 'bottom', weight: 0.25, issueText: 'Lower chest closer to hands' },
      { joints: ['left_shoulder', 'left_hip', 'left_ankle'], min: 130, max: 180, phase: 'bottom', weight: 0.15, issueText: 'Keep body in a straight line' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully at the top' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 140, max: 180, phase: 'top', weight: 0.15, issueText: 'Extend arms fully at the top' },
    ],
  },

  // ── WIDE PUSH-UP ──────────────────────────────────────────
  {
    id: 'wide_pushup',
    name: 'Wide Push-up',
    category: 'Chest',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'right_shoulder', 'right_elbow', 'right_wrist'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 145,
    },
    pattern: 'horizontal_push',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 50, max: 110, phase: 'bottom', weight: 0.25, issueText: 'Lower chest towards floor' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 50, max: 110, phase: 'bottom', weight: 0.25, issueText: 'Lower chest towards floor' },
      { joints: ['left_shoulder', 'left_hip', 'left_ankle'], min: 130, max: 180, phase: 'bottom', weight: 0.15, issueText: 'Keep body straight — no sagging hips' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 135, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend arms fully at the top' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 135, max: 180, phase: 'top', weight: 0.15, issueText: 'Extend arms fully at the top' },
    ],
  },

  // ── HIP THRUST ────────────────────────────────────────────
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    category: 'Glutes',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee', 'right_hip', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 100,
      topThreshold: 155,
    },
    pattern: 'glute_bridge',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 150, max: 180, phase: 'top', weight: 0.3, issueText: 'Drive hips up higher — full extension at top' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 150, max: 180, phase: 'top', weight: 0.3, issueText: 'Drive hips up higher — full extension at top' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 110, phase: 'bottom', weight: 0.2, issueText: 'Keep knees at ~90° — feet flat on floor' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 70, max: 110, phase: 'bottom', weight: 0.2, issueText: 'Keep knees at ~90° — feet flat on floor' },
    ],
  },

  // ── ARNOLD PRESS ──────────────────────────────────────────
  {
    id: 'arnold_press',
    name: 'Arnold Press',
    category: 'Shoulders',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'right_shoulder', 'right_elbow'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_elbow', 'left_wrist'],
      bottomThreshold: 100,
      topThreshold: 155,
    },
    pattern: 'vertical_push',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 60, max: 110, phase: 'bottom', weight: 0.25, issueText: 'Start with elbows in front — palms facing you' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 60, max: 110, phase: 'bottom', weight: 0.25, issueText: 'Start with elbows in front — palms facing you' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 155, max: 180, phase: 'top', weight: 0.25, issueText: 'Press all the way up — rotate palms outward' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 155, max: 180, phase: 'top', weight: 0.25, issueText: 'Press all the way up — rotate palms outward' },
    ],
  },

  // ── BENT OVER ROW ─────────────────────────────────────────
  {
    id: 'bent_over_row',
    name: 'Bent Over Row',
    category: 'Back',
    primaryJoints: ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip', 'left_knee'],
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
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 40, max: 90, phase: 'bottom', weight: 0.25, issueText: 'Pull elbows back — squeeze shoulder blades together' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 40, max: 90, phase: 'bottom', weight: 0.25, issueText: 'Pull elbows back — squeeze shoulder blades together' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 120, phase: 'bottom', weight: 0.2, issueText: 'Keep back flat — hinge at hips about 45°' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 120, max: 180, phase: 'top', weight: 0.15, issueText: 'Extend arms fully at bottom of movement' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 120, max: 180, phase: 'top', weight: 0.15, issueText: 'Extend arms fully at bottom of movement' },
    ],
  },

  // ── GOOD MORNING ──────────────────────────────────────────
  {
    id: 'good_morning',
    name: 'Good Morning',
    category: 'Back',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_knee'],
      bottomThreshold: 100,
      topThreshold: 155,
    },
    pattern: 'hip_hinge',
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 55, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Hinge deeper at hips — keep back flat' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 150, max: 180, phase: 'bottom', weight: 0.25, issueText: 'Keep legs straight — only slight knee bend' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully — squeeze glutes at top' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully' },
    ],
  },

  // ── ROMANIAN DEADLIFT ─────────────────────────────────────
  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift',
    category: 'Legs',
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
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 55, max: 110, phase: 'bottom', weight: 0.35, issueText: 'Hinge at hips — push butt back, keep back flat' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 145, max: 180, phase: 'bottom', weight: 0.25, issueText: 'Keep legs nearly straight — slight knee bend only' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully — squeeze glutes at top' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 155, max: 180, phase: 'top', weight: 0.2, issueText: 'Stand up fully' },
    ],
  },

  // ── STEP-UP ───────────────────────────────────────────────
  {
    id: 'step_up',
    name: 'Step-up',
    category: 'Legs',
    primaryJoints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee'],
    phaseDetection: {
      primaryAngle: ['left_hip', 'left_knee', 'left_ankle'],
      bottomThreshold: 110,
      topThreshold: 160,
    },
    pattern: 'squat',
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 70, max: 115, phase: 'bottom', weight: 0.3, issueText: 'Place foot firmly on step — knee at ~90°' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 60, max: 130, phase: 'bottom', weight: 0.2, issueText: 'Keep torso upright — don\'t lean forward' },
      { joints: ['left_hip', 'left_knee', 'left_ankle'], min: 155, max: 180, phase: 'top', weight: 0.25, issueText: 'Stand fully on the step — lock out at top' },
      { joints: ['right_hip', 'right_knee', 'right_ankle'], min: 155, max: 180, phase: 'top', weight: 0.25, issueText: 'Bring trailing leg up to the step' },
    ],
  },

  // ── MOUNTAIN CLIMBER ──────────────────────────────────────
  {
    id: 'mountain_climber',
    name: 'Mountain Climber',
    category: 'Cardio',
    primaryJoints: ['left_hip', 'left_knee', 'right_hip', 'right_knee', 'left_shoulder'],
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
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 55, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Drive knee closer to chest' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 55, max: 110, phase: 'bottom', weight: 0.3, issueText: 'Drive knee closer to chest' },
      { joints: ['left_shoulder', 'left_hip', 'left_knee'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend leg back fully' },
      { joints: ['right_shoulder', 'right_hip', 'right_knee'], min: 140, max: 180, phase: 'top', weight: 0.2, issueText: 'Extend leg back fully' },
    ],
  },

  // ── PLANK HOLD (Isometric) ────────────────────────────────
  {
    id: 'plank_hold',
    name: 'Plank Hold',
    category: 'Core',
    primaryJoints: ['left_shoulder', 'left_hip', 'left_ankle', 'right_shoulder', 'right_hip'],
    phaseDetection: {
      primaryAngle: ['left_shoulder', 'left_hip', 'left_ankle'],
      bottomThreshold: 140,
      topThreshold: 170,
    },
    pattern: 'plank_hold',
    defaultSets: 3,
    defaultReps: 1,
    restSeconds: 60,
    angleConstraints: [
      { joints: ['left_shoulder', 'left_hip', 'left_ankle'], min: 150, max: 180, phase: 'bottom', weight: 0.3, issueText: 'Keep body in a straight line — don\'t let hips sag' },
      { joints: ['right_shoulder', 'right_hip', 'right_ankle'], min: 150, max: 180, phase: 'bottom', weight: 0.3, issueText: 'Keep body in a straight line — don\'t let hips sag' },
      { joints: ['left_shoulder', 'left_elbow', 'left_wrist'], min: 70, max: 120, phase: 'bottom', weight: 0.2, issueText: 'Keep elbows under shoulders' },
      { joints: ['right_shoulder', 'right_elbow', 'right_wrist'], min: 70, max: 120, phase: 'bottom', weight: 0.2, issueText: 'Keep elbows under shoulders' },
    ],
  },
];

export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function getExercisesByCategory(category: string): ExerciseDefinition[] {
  return EXERCISES.filter((e) => e.category.toLowerCase() === category.toLowerCase());
}
