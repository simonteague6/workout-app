// workoutStore — backward-compatible barrel re-exporting from the split stores.
//
// The original workoutStore was split into two deeper modules (architecture
// review 2026-06-23):
//   sessionStore.js        — lifecycle (start, resume, finish) + activeSession
//   workoutOperationsStore.js — mutations (add/complete/delete sets, exercises,
//                               supersets) + rest timer state
//
// This file re-exports both so existing imports continue to work. New code
// SHOULD import from the specific store it needs.

export { useSessionStore as useWorkoutStore } from './sessionStore.js';
export { useWorkoutOperationsStore } from './workoutOperationsStore.js';
