// sessionStore — WorkoutSession lifecycle (start, resume, finish).
//
// Owns the activeSession tree — the canonical in-memory representation of the
// live workout. workoutOperationsStore reads and mutates this tree via
// getState() / setState() so both stores share one source of truth.
//
// Persistence rule (PRD stories 23–24): the live session survives tab switches
// (this store is a module singleton) and app restarts (resumeInterrupted reads
// the unfinished session back out of SQLite).

import { create } from 'zustand';

import { getDatabase } from '../utils/db.js';
import * as sessionQueries from '../db/queries/sessionQueries.js';
import { getRoutineDetail } from '../db/queries/routineQueries.js';
import { getExerciseById } from '../db/queries/exerciseQueries.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Re-hydrate the full active-session tree from SQLite. Used after structural
 * mutations and on resume, so the in-memory tree always matches the DB.
 */
function hydrateActiveSession(db, sessionId) {
  const detail = sessionQueries.getSessionDetail(db, sessionId);
  if (!detail) return null;
  const exercises = detail.exercises.map((we) => ({
    ...we,
    exercise: getExerciseById(db, we.exercise_id) ?? { id: we.exercise_id, name: we.name },
    sets: we.sets,
    supersetGroupId: we.supersetGroupId ?? null,
    previousSets: sessionQueries.getLastSessionSetsForExercise(db, we.exercise_id, {
      excludeSessionId: sessionId,
    }),
  }));
  return { ...detail, exercises };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SessionState
 * @property {object|null} activeSession     nested session tree (null when none)
 * @property {boolean} isLoading
 * @property {string|null} error
 * @property {object|null} lastSessionStats    stats from the most recently finished session
 */

export const useSessionStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  activeSession: null,
  isLoading: false,
  error: null,
  lastSessionStats: null,

  // -- lifecycle ------------------------------------------------------------

  /** Start a Free Flow session (routine_id = null). Returns the active session. */
  startFreeFlow: async () => {
    const db = getDatabase();
    const session = sessionQueries.createSession(db, { routineId: null });
    const active = { ...session, exercises: [] };
    set({ activeSession: active, lastSessionStats: null });
    return active;
  },

  /** Start a routine-driven workout: creates a session linked to the routine,
   *  pre-loads each routine exercise with target_sets set rows (reps from the
   *  routine's target_reps_max, weight pre-filled from prior history), and
   *  records the routine_exercise origin on each workout_exercise so the finish
   *  diff + rest-timer hierarchy work. Returns the active session. */
  startFromRoutine: async (routineId) => {
    const db = getDatabase();
    const detail = getRoutineDetail(db, routineId);
    if (!detail) throw new Error('sessionStore.startFromRoutine: routine not found');
    const session = sessionQueries.createSession(db, { routineId });
    for (const re of detail.exercises) {
      const we = sessionQueries.addWorkoutExercise(db, {
        sessionId: session.id,
        exerciseId: re.exercise_id,
        substitutedFromRoutineExerciseId: re.id,
      });
      const lastSets = sessionQueries.getLastSessionSetsForExercise(db, re.exercise_id, {
        excludeSessionId: session.id,
      });
      const targetSets = Math.max(1, re.target_sets ?? 1);
      for (let i = 0; i < targetSets; i++) {
        db.execute(
          `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps, set_type, is_completed)
             VALUES (?, ?, ?, ?, 'normal', 0)`,
          [we.id, i, lastSets[i]?.weight ?? null, re.target_reps_max || null],
        );
      }
    }
    const active = hydrateActiveSession(db, session.id);
    set({ activeSession: active, lastSessionStats: null });
    return active;
  },

  /** Reload an interrupted (unfinished) session after an app restart. */
  resumeInterrupted: async () => {
    const db = getDatabase();
    const session = sessionQueries.getActiveSession(db);
    if (!session) {
      set({ activeSession: null });
      return null;
    }
    const active = hydrateActiveSession(db, session.id);
    set({ activeSession: active });
    return active;
  },

  /** Re-read the active session from SQLite (keeps the tree in sync). */
  loadActiveSession: async () => {
    const current = get().activeSession;
    if (!current) return null;
    const active = hydrateActiveSession(getDatabase(), current.id);
    set({ activeSession: active });
    return active;
  },

  // -- finish ---------------------------------------------------------------

  /** Finish the active session: persist completion, compute stats, clear state. */
  finishWorkout: async ({ bodyWeight, notes } = {}) => {
    const db = getDatabase();
    const session = get().activeSession;
    if (!session) throw new Error('sessionStore.finishWorkout: no active session');
    sessionQueries.finishSession(db, session.id, { bodyWeight, notes });
    const stats = sessionQueries.getSessionStats(db, session.id);
    const withId = { ...stats, sessionId: session.id, routineId: session.routine_id ?? null };
    set({
      activeSession: null,
      lastSessionStats: withId,
    });
    return withId;
  },

  /** Clear the finished-session stats (after the finish screen dismisses). */
  dismissFinished: () => set({ lastSessionStats: null }),

  /** Save the just-finished free-flow session as a routine template. */
  saveAsTemplate: async (sessionId, name) => {
    const db = getDatabase();
    return sessionQueries.saveSessionAsTemplate(db, sessionId, name);
  },

  /** Drop the in-memory active session without finishing (abandon). */
  clearActiveSession: () => set({ activeSession: null }),
}));
