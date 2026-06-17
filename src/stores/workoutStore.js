// workoutStore — live WorkoutSession state (the center of the app).
//
// Empty shell for the scaffold (issue #1). Live-session actions — start free
// flow / routine-driven, add exercise, add set, complete set (rest timer +
// pair-frequency increment), substitute, mark set type, superset, finish
// (routine-vs-actual diff), resume interrupted session — are implemented in
// issue #3 against the acceptance criteria there.
//
// Persistence rule: the live session persists across tab switches and app
// restarts (PRD stories 23–24), so this store is the source of truth for the
// active session; history reads come from SQLite via sessionQueries.

import { create } from 'zustand';

/**
 * @typedef {Object} WorkoutState
 * @property {WorkoutSession|null} activeSession  Currently open session (null when none).
 * @property {boolean} isLoading
 * @property {number|null} restTimerEndsAt  epoch ms when the running rest timer ends (null = idle)
 * @property {number} restTimerDuration    seconds currently counting down
 */

export const useWorkoutStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  activeSession: null,
  isLoading: false,
  restTimerEndsAt: null,
  restTimerDuration: 0,

  // -- actions (implemented in issue #3) ------------------------------------
  startFreeFlow: async () => {
    throw new Error('workoutStore.startFreeFlow: not implemented (issue #3)');
  },
  startFromRoutine: async (_routineId) => {
    throw new Error('workoutStore.startFromRoutine: not implemented (issue #3)');
  },
  resumeInterrupted: async () => {
    throw new Error('workoutStore.resumeInterrupted: not implemented (issue #3)');
  },
  addExercise: async (_exerciseId) => {
    throw new Error('workoutStore.addExercise: not implemented (issue #3)');
  },
  addSet: async (_workoutExerciseId) => {
    throw new Error('workoutStore.addSet: not implemented (issue #3)');
  },
  completeSet: async (_setId) => {
    throw new Error('workoutStore.completeSet: not implemented (issue #3)');
  },
  substituteExercise: async (_workoutExerciseId, _newExerciseId) => {
    throw new Error('workoutStore.substituteExercise: not implemented (issue #3)');
  },
  setSetType: async (_setId, _setType) => {
    throw new Error('workoutStore.setSetType: not implemented (issue #3)');
  },
  createSuperset: async (_workoutExerciseIds) => {
    throw new Error('workoutStore.createSuperset: not implemented (issue #3)');
  },
  finishWorkout: async () => {
    throw new Error('workoutStore.finishWorkout: not implemented (issue #3)');
  },
}));