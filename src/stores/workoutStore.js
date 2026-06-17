// workoutStore — live WorkoutSession state (the center of the app).
//
// Source of truth for the active session. Every action writes through to
// SQLite via sessionQueries and mirrors the result into `activeSession`, a
// nested tree the UI renders directly:
//
//   activeSession = {
//     ...workoutSessionRow,
//     exercises: [{
//       ...workoutExerciseRow,
//       exercise: { ...resolved exercise row (default_rest_seconds, …) },
//       sets:      [ ...exerciseSetRow ],
//       supersetGroupId: number | null,
//     }],
//   }
//
// Persistence rule (PRD stories 23–24): the live session survives tab switches
// (this store is a module singleton) and app restarts (resumeInterrupted reads
// the unfinished session back out of SQLite). History reads come from
// sessionQueries, not this store.
//
// Rest timer hierarchy (PRD): routine > exercise > app default (2 min). For a
// free-flow session there is no routine link, so it collapses to
// exercise.default_rest_seconds → settings.defaultRestSeconds. Warm-up sets
// never start the timer; the rest timer fires only after the last drop in a
// contiguous drop group, and after both exercises in a superset complete a
// round.

import { create } from 'zustand';

import { getDatabase } from '../utils/db.js';
import * as sessionQueries from '../db/queries/sessionQueries.js';
import { getExerciseById } from '../db/queries/exerciseQueries.js';
import { useSettingsStore } from './settingsStore.js';

const SET_CYCLE = ['normal', 'warmup', 'dropset', 'failure'];

/**
 * @typedef {Object} WorkoutState
 * @property {object|null} activeSession     nested session tree (null when none)
 * @property {boolean} isLoading
 * @property {string|null} error
 * @property {number|null} restTimerEndsAt    epoch ms when the running rest timer ends (null = idle)
 * @property {number} restTimerTotalSeconds  total seconds of the running timer (0 when idle)
 * @property {object|null} lastSessionStats    stats from the most recently finished session (finish screen)
 */

// Re-hydrate the full active-session tree from SQLite. Used after structural
// mutations (substitute / remove / reorder / superset) and on resume, so the
// in-memory tree always matches the DB — including superset group tags.
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


// Find a set entry plus its owning exercise entry by set id.
function findSet(state, setId) {
  for (const ex of state.activeSession?.exercises ?? []) {
    const set = ex.sets.find((s) => s.id === setId);
    if (set) return { set, entry: ex };
  }
  return { set: null, entry: null };
}

// Count completed sets on an exercise entry (for the superset shared-timer rule).
function completedCount(entry) {
  return entry.sets.filter((s) => s.is_completed === 1).length;
}

// Resolve the rest duration for a set per the hierarchy routine > exercise > app.
function resolveRestDuration(entry) {
  const db = getDatabase();
  if (entry.substituted_from_routine_exercise_id) {
    const row = db
      .execute('SELECT target_rest_seconds FROM routine_exercise WHERE id = ?', [
        entry.substituted_from_routine_exercise_id,
      ])
      .rows[0];
    if (row && row.target_rest_seconds != null) return row.target_rest_seconds;
  }
  if (entry.exercise && entry.exercise.default_rest_seconds != null) {
    return entry.exercise.default_rest_seconds;
  }
  return useSettingsStore.getState().defaultRestSeconds;
}

// Decide whether completing `set` (in `entry`) should start the rest timer.
// Returns the duration in seconds, or null when the timer should NOT fire.
function shouldStartRestTimer(state, set, entry) {
  if (set.set_type === 'warmup') return null;
  if (set.set_type === 'dropset') {
    // More drops remain in this group? The next set, if it is an uncompleted
    // drop set, means this was not the last drop — hold the timer.
    const next = entry.sets.find((s) => s.sort_order === set.sort_order + 1);
    if (next && next.set_type === 'dropset' && next.is_completed === 0) return null;
  }
  if (entry.supersetGroupId != null) {
    // Shared timer: fire only once both paired exercises have completed the
    // same number of sets this round. The set being completed counts as +1, so
    // the timer is held while this exercise is ahead of its partner.
    const partner = state.activeSession.exercises.find(
      (e) => e.supersetGroupId === entry.supersetGroupId && e.id !== entry.id,
    );
    if (partner && completedCount(entry) + 1 > completedCount(partner)) return null;
  }
  return resolveRestDuration(entry);
}

// Replace one exercise entry in the active session immutably.
function patchEntry(state, workoutExerciseId, patch) {
  const exercises = state.activeSession.exercises.map((e) =>
    e.id === workoutExerciseId ? { ...e, ...patch } : e,
  );
  return { activeSession: { ...state.activeSession, exercises } };
}

// Replace one set within its exercise entry.
function patchSet(state, setId, patch) {
  const exercises = state.activeSession.exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }));
  return { activeSession: { ...state.activeSession, exercises } };
}

export const useWorkoutStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  activeSession: null,
  isLoading: false,
  error: null,
  restTimerEndsAt: null,
  restTimerTotalSeconds: 0,
  lastSessionStats: null,

  // -- lifecycle ------------------------------------------------------------

  /** Start a Free Flow session (routine_id = null). Returns the active session. */
  startFreeFlow: async () => {
    const db = getDatabase();
    const session = sessionQueries.createSession(db, { routineId: null });
    const active = { ...session, exercises: [] };
    set({ activeSession: active, restTimerEndsAt: null, restTimerTotalSeconds: 0, lastSessionStats: null });
    return active;
  },

  /** Start from a routine (issue #4): not yet implemented. */
  startFromRoutine: async (_routineId) => {
    throw new Error('workoutStore.startFromRoutine: not implemented (issue #4)');
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

  // -- exercises ------------------------------------------------------------

  /** Append an exercise to the active session; bumps pair frequency. */
  addExercise: async (exerciseId) => {
    const db = getDatabase();
    const session = get().activeSession;
    if (!session) throw new Error('workoutStore.addExercise: no active session');
    const we = sessionQueries.addWorkoutExercise(db, { sessionId: session.id, exerciseId });
    const exercise = getExerciseById(db, exerciseId);
    const entry = {
      ...we,
      exercise,
      sets: [],
      supersetGroupId: null,
      previousSets: sessionQueries.getLastSessionSetsForExercise(db, exerciseId, {
        excludeSessionId: session.id,
      }),
    };
    set((state) => ({
      activeSession: { ...state.activeSession, exercises: [...state.activeSession.exercises, entry] },
    }));
    return entry;
  },

  /** Substitute the exercise on a workout_exercise (keeps history). */
  substituteExercise: async (workoutExerciseId, newExerciseId) => {
    const db = getDatabase();
    const session = get().activeSession;
    sessionQueries.substituteExercise(db, workoutExerciseId, newExerciseId);
    set({ activeSession: hydrateActiveSession(db, session.id) });
    return get().activeSession;
  },

  /** Pair-frequency-sorted exercise suggestions for the add-exercise modal.
   *  The last exercise added to the active session seeds the pair ranking. */
  suggestExercises: (query = '') => {
    const db = getDatabase();
    const ex = get().activeSession?.exercises ?? [];
    const lastExerciseId = ex.length ? ex[ex.length - 1].exercise_id : null;
    return sessionQueries.getExerciseSuggestions(db, { lastExerciseId, query });
  },

  /** Remove a workout_exercise (cascades to its sets + superset membership). */
  removeWorkoutExercise: async (workoutExerciseId) => {
    const db = getDatabase();
    const session = get().activeSession;
    sessionQueries.removeWorkoutExercise(db, workoutExerciseId);
    set({ activeSession: hydrateActiveSession(db, session.id) });
    return get().activeSession;
  },

  /** Rewrite exercise order. Pass the workout_exercise ids in display order. */
  reorderExercises: async (orderedIds) => {
    const db = getDatabase();
    const session = get().activeSession;
    sessionQueries.reorderWorkoutExercises(db, session.id, orderedIds);
    set({ activeSession: hydrateActiveSession(db, session.id) });
    return get().activeSession;
  },

  /** Set the sticky notes on a workout_exercise. */
  setExerciseNotes: async (workoutExerciseId, notes) => {
    const db = getDatabase();
    sessionQueries.setWorkoutExerciseNotes(db, workoutExerciseId, notes);
    set((state) => patchEntry(state, workoutExerciseId, { notes }));
    return get().activeSession.exercises.find((e) => e.id === workoutExerciseId);
  },

  // -- sets -----------------------------------------------------------------

  /** Append a set (weight/reps pre-filled from the last session). */
  addSet: async (workoutExerciseId) => {
    const db = getDatabase();
    const newSet = sessionQueries.addSet(db, { workoutExerciseId });
    set((state) => ({
      activeSession: {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === workoutExerciseId ? { ...e, sets: [...e.sets, newSet] } : e,
        ),
      },
    }));
    return newSet;
  },

  /** Mark a set complete; starts the rest timer per the hierarchy. */
  completeSet: async (setId, { restDuration } = {}) => {
    const db = getDatabase();
    const state = get();
    const { set: setRow, entry } = findSet(state, setId);
    if (!setRow || !entry) throw new Error('workoutStore.completeSet: set not found');

    const duration = restDuration ?? shouldStartRestTimer(state, setRow, entry);
    const completed = sessionQueries.completeSet(db, setId, { restDuration: duration });

    set((s) => ({
      ...patchSet(s, setId, completed),
      restTimerEndsAt: duration != null ? Date.now() + duration * 1000 : null,
      restTimerTotalSeconds: duration ?? 0,
    }));
    return completed;
  },

  /** Cycle the set-type marker: Normal → Warm-up → Drop-set → Failure → Normal. */
  cycleSetType: async (setId) => {
    const state = get();
    const { set: setRow } = findSet(state, setId);
    if (!setRow) throw new Error('workoutStore.cycleSetType: set not found');
    const idx = SET_CYCLE.indexOf(setRow.set_type);
    const next = SET_CYCLE[(idx + 1) % SET_CYCLE.length];
    const updated = sessionQueries.updateSetType(getDatabase(), setId, next);
    set((s) => patchSet(s, setId, updated));
    return updated;
  },

  /** Set the marker directly (normal | warmup | dropset | failure). */
  setSetType: async (setId, setType) => {
    const updated = sessionQueries.updateSetType(getDatabase(), setId, setType);
    set((s) => patchSet(s, setId, updated));
    return updated;
  },

  /** Partially update weight / reps / rpe on a set. */
  updateSetFields: async (setId, patch) => {
    const updated = sessionQueries.updateSetFields(getDatabase(), setId, patch);
    set((s) => patchSet(s, setId, updated));
    return updated;
  },

  /** Remove a set. */
  deleteSet: async (setId) => {
    sessionQueries.deleteSet(getDatabase(), setId);
    set((state) => ({
      activeSession: {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) => ({
          ...e,
          sets: e.sets.filter((s) => s.id !== setId),
        })),
      },
    }));
  },

  // -- supersets ------------------------------------------------------------

  /** Pair workout exercises into a superset (shared rest timer). */
  createSuperset: async (workoutExerciseIds) => {
    const db = getDatabase();
    const session = get().activeSession;
    const groupId = sessionQueries.createSuperset(db, session.id, workoutExerciseIds);
    set({ activeSession: hydrateActiveSession(db, session.id) });
    return groupId;
  },

  /** Remove a workout_exercise from its superset. */
  removeFromSuperset: async (workoutExerciseId) => {
    const db = getDatabase();
    const session = get().activeSession;
    sessionQueries.removeFromSuperset(db, workoutExerciseId);
    set({ activeSession: hydrateActiveSession(db, session.id) });
    return get().activeSession;
  },

  // -- rest timer -----------------------------------------------------------

  /** Start (or restart) the rest timer for `seconds`. */
  startRestTimer: (seconds) => {
    set({ restTimerEndsAt: Date.now() + seconds * 1000, restTimerTotalSeconds: seconds });
  },

  /** Stop the rest timer. */
  stopRestTimer: () => {
    set({ restTimerEndsAt: null, restTimerTotalSeconds: 0 });
  },

  /** Add seconds to the running timer (the +30s control). */
  addRestTime: (seconds) => {
    const ends = get().restTimerEndsAt;
    if (ends == null) return;
    set({ restTimerEndsAt: ends + seconds * 1000 });
  },

  // -- finish ---------------------------------------------------------------

  /** Finish the active session: persist completion, compute stats, clear state. */
  finishWorkout: async ({ bodyWeight, notes } = {}) => {
    const db = getDatabase();
    const session = get().activeSession;
    if (!session) throw new Error('workoutStore.finishWorkout: no active session');
    sessionQueries.finishSession(db, session.id, { bodyWeight, notes });
    const stats = sessionQueries.getSessionStats(db, session.id);
    const withId = { ...stats, sessionId: session.id };
    set({
      activeSession: null,
      restTimerEndsAt: null,
      restTimerTotalSeconds: 0,
      lastSessionStats: withId,
    });
    return withId;
  },

  /** Clear the finished-session stats (after the finish screen dismisses). */
  dismissFinished: () => set({ lastSessionStats: null }),

  /** Save the just-finished free-flow session as a routine template. Returns
   *  the new routine id. Call after finishWorkout (uses lastSessionStats' session
   *  id is gone, so pass the finished session id explicitly). */
  saveAsTemplate: async (sessionId, name) => {
    const db = getDatabase();
    return sessionQueries.saveSessionAsTemplate(db, sessionId, name);
  },

  /** Drop the in-memory active session without finishing (abandon). */
  clearActiveSession: () =>
    set({ activeSession: null, restTimerEndsAt: null, restTimerTotalSeconds: 0 }),
}));