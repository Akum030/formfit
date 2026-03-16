/**
 * Shared TypeScript types for the AI Gym Trainer frontend.
 */

// ── MoveNet Keypoints ─────────────────────────────────────

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

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export type Pose = Keypoint[];

// ── Exercise Definitions ──────────────────────────────────

export type RepPhase = 'eccentric' | 'concentric' | 'bottom' | 'top';

export interface AngleConstraint {
  joints: [JointName, JointName, JointName];
  min: number;
  max: number;
  phase: RepPhase;
  weight: number;
  issueText: string;
}

export interface PhaseDetection {
  primaryAngle: [JointName, JointName, JointName];
  bottomThreshold: number;
  topThreshold: number;
}

export type MovementPattern =
  | 'squat' | 'hip_hinge' | 'vertical_push'
  | 'horizontal_push' | 'lunge' | 'curl' | 'plank_hold'
  | 'lateral_raise' | 'row' | 'crunch' | 'leg_raise'
  | 'calf_raise' | 'glute_bridge' | 'jumping' | 'tricep_extension';

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

/** API-returned exercise summary (no angle constraints). */
export interface ExerciseSummary {
  id: string;
  name: string;
  category: string;
  defaultSets: number;
  defaultReps: number;
  restSeconds: number;
}

// ── Form Scoring ──────────────────────────────────────────

export type ScoreColor = 'green' | 'yellow' | 'red';

export interface FrameScore {
  score: number;        // 0..1
  scorePercent: number; // 0..100
  issues: string[];
  phase: RepPhase;
}

export interface RepScore {
  repNumber: number;
  avgScore: number;     // 0..100
  minScore: number;
  issues: string[];
}

export interface PhaseState {
  current: RepPhase;
  angle: number;
  repCount: number;
  wasAtBottom: boolean;
}

// ── Session ───────────────────────────────────────────────

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface Session {
  id: string;
  exerciseId: string;
  userId?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  totalReps?: number;
  totalSets?: number;
  targetReps?: number;
  avgFormScore?: number;
  aiSummary?: string;
  setLogs?: SetLog[];
}

export interface SetLog {
  id: string;
  sessionId: string;
  setNumber: number;
  repsCount: number;
  avgFormScore?: number;
  duration?: number;
  repLogs?: RepLog[];
}

export interface RepLog {
  id: string;
  setLogId: string;
  repNumber: number;
  formScore: number;
  issues: string;
  timestamp: string;
}

// ── Coaching ──────────────────────────────────────────────

export interface CoachingMessage {
  text: string;
  audioBase64: string;
  trigger: 'form' | 'rep' | 'user_speech' | 'set_transition' | 'session_start' | 'session_end';
}

// ── Voice ─────────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceMessage {
  type: 'ready' | 'transcript' | 'coaching' | 'interrupted' | 'pong';
  text?: string;
  confidence?: number;
  audioBase64?: string;
  trigger?: string;
  sessionId?: string;
}
