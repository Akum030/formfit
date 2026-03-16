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
];

export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id);
}
