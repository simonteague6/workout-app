// workoutOperationsStore — mutations on the active WorkoutSession.
//
// Owns the rest timer state and every action that modifies the active session
// tree (add/remove/reorder exercises, add/complete/delete sets, supersets).
// Reads and writes the activeSession through useSessionStore so both stores
// share one canonical source of truth.
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
import { useSessionStore } from './sessionStore.js';

const SET_CYCLE = ['normal', 'warmup', 'dropset', 'failure'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Find a set entry plus its owning exercise entry by set id. */
function findSet(activeSession, setId) {
  for (const ex of activeSession?.exercises ?? []) {
    const set = ex.sets.find((s) => s.id === setId);
    if (set) return { set, entry: ex };
  }
  return { set: null, entry: null };
}

/** Count completed sets on an exercise entry (for the superset shared-timer rule). */
function completedCount(entry) {
  return entry.sets.filter((s) => s.is_completed === 1).length;
}

/** Resolve the rest duration for a set per the hierarchy routine > exercise > app. */
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

/** Decide whether completing `set` (in `entry`) should start the rest timer.
 *  Returns the duration in seconds, or null when the timer should NOT fire. */
function shouldStartRestTimer(activeSession, set, entry) {
  if (set.set_type === 'warmup') return null;
  if (set.set_type === 'dropset') {
    const next = entry.sets.find((s) => s.sort_order === set.sort_order + 1);
    if (next && next.set_type === 'dropset' && next.is_completed === 0) return null;
  }
  if (entry.supersetGroupId != null) {
    const partner = activeSession.exercises.find(
      (e) => e.supersetGroupId === entry.supersetGroupId && e.id !== entry.id,
    );
    if (partner && completedCount(entry) + 1 > completedCount(partner)) return null;
  }
  return resolveRestDuration(entry);
}

/** Replace one exercise entry in the active session immutably. */
function patchEntry(activeSession, workoutExerciseId, patch) {
  const exercises = activeSession.exercises.map((e) =>
    e.id === workoutExerciseId ? { ...e, ...patch } : e,
  );
  return { ...activeSession, exercises };
}

/** Replace one set within its exercise entry. */
function patchSet(activeSession, setId, patch) {
  const exercises = activeSession.exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }));
  return { ...activeSession, exercises };
}

/** Re-hydrate the full active-session tree from SQLite. */
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
 * @typedef {Object} WorkoutOperationsState
 * @property {number|null} restTimerEndsAt    epoch ms when the running rest timer ends (null = idle)
 * @property {number} restTimerTotalSeconds  total seconds of the running timer (0 when idle)
 */

export const useWorkoutOperationsStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  restTimerEndsAt: null,
  restTimerTotalSeconds: 0,

  // -- exercises ------------------------------------------------------------

  /** Append an exercise to the active session; bumps pair frequency. */
  addExercise: async (exerciseId) => {
    const db = getDatabase();
    const session = useSessionStore.getState().activeSession;
    if (!session) throw new Error('workoutOperationsStore.addExercise: no active session');
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
    useSessionStore.setState((s) => ({
      activeSession: { ...s.activeSession, exercises: [...s.activeSession.exercises, entry] },
    }));
    return entry;
  },

  /** Substitute the exercise on a workout_exercise for this session only. */
  substituteExercise: async (workoutExerciseId, newExerciseId) => {
    const db = getDatabase();
    const session = useSessionStore.getState().activeSession;
    sessionQueries.substituteExercise(db, workoutExerciseId, newExerciseId);
    sessionQueries.rePrefillSetWeightsForSubstitute(db, workoutExerciseId);
    useSessionStore.setState({ activeSession: hydrateActiveSession(db, session.id) });
    return useSessionStore.getState().activeSession;
  },

  /** Pair-frequency-sorted exercise suggestions for the add-exercise modal. */
  suggestExercises: (query = '') => {
    const db = getDatabase();
    const ex = useSessionStore.getState().activeSession?.exercises ?? [];
    const lastExerciseId = ex.length ? ex[ex.length - 1].exercise_id : null;
    return sessionQueries.getExerciseSuggestions(db, { lastExerciseId, query });
  },

  /** Remove a workout_exercise (cascades to its sets + superset membership). */
  removeWorkoutExercise: async (workoutExerciseId) => {
    const db = getDatabase();
    const session = useSessionStore.getState().activeSession;
    sessionQueries.removeWorkoutExercise(db, workoutExerciseId);
    useSessionStore.setState({ activeSession: hydrateActiveSession(db, session.id) });
    return useSessionStore.getState().activeSession;
  },

  /** Rewrite exercise order. Pass the workout_exercise ids in display order. */
  reorderExercises: async (orderedIds) => {
    const db = getDatabase();
    const session = useSessionStore.getState().activeSession;
    sessionQueries.reorderWorkoutExercises(db, session.id, orderedIds);
    useSessionStore.setState({ activeSession: hydrateActiveSession(db, session.id) });
    return useSessionStore.getState().activeSession;
  },

  /** Set the sticky notes on a workout_exercise. */
  setExerciseNotes: async (workoutExerciseId, notes) => {
    const db = getDatabase();
    sessionQueries.setWorkoutExerciseNotes(db, workoutExerciseId, notes);
    useSessionStore.setState((s) => ({
      activeSession: patchEntry(s.activeSession, workoutExerciseId, { notes }),
    }));
    return useSessionStore.getState().activeSession.exercises.find((e) => e.id === workoutExerciseId);
  },

  // -- sets -----------------------------------------------------------------

  /** Append a set (weight/reps pre-filled from the last session). */
  addSet: async (workoutExerciseId) => {
    const db = getDatabase();
    const newSet = sessionQueries.addSet(db, { workoutExerciseId });
    useSessionStore.setState((s) => ({
      activeSession: {
        ...s.activeSession,
        exercises: s.activeSession.exercises.map((e) =>
          e.id === workoutExerciseId ? { ...e, sets: [...e.sets, newSet] } : e,
        ),
      },
    }));
    return newSet;
  },

  /** Mark a set complete; starts the rest timer per the hierarchy. */
  completeSet: async (setId, { restDuration } = {}) => {
    const db = getDatabase();
    const activeSession = useSessionStore.getState().activeSession;
    const { set: setRow, entry } = findSet(activeSession, setId);
    if (!setRow || !entry) throw new Error('workoutOperationsStore.completeSet: set not found');

    // Validate: non-warmup sets must have reps > 0.
    if (setRow.set_type !== 'warmup' && (setRow.reps == null || setRow.reps === 0)) {
      throw new Error('Cannot complete a set with 0 reps');
    }

    const duration = restDuration ?? shouldStartRestTimer(activeSession, setRow, entry);
    const completed = sessionQueries.completeSet(db, setId, { restDuration: duration });

    useSessionStore.setState((s) => ({
      activeSession: patchSet(s.activeSession, setId, completed),
    }));
    set({
      restTimerEndsAt: duration != null ? Date.now() + duration * 1000 : null,
      restTimerTotalSeconds: duration ?? 0,
    });
    return completed;
  },

  /** Toggle a set's completion state. */
  toggleCompleteSet: async (setId) => {
    const activeSession = useSessionStore.getState().activeSession;
    const { set: setRow } = findSet(activeSession, setId);
    if (!setRow) throw new Error('workoutOperationsStore.toggleCompleteSet: set not found');
    if (setRow.is_completed === 1) {
      const uncompleted = sessionQueries.uncompleteSet(getDatabase(), setId);
      useSessionStore.setState((s) => ({
        activeSession: patchSet(s.activeSession, setId, uncompleted),
      }));
      set({ restTimerEndsAt: null, restTimerTotalSeconds: 0 });
      return uncompleted;
    }
    return get().completeSet(setId);
  },

  /** Cycle the set-type marker: Normal → Warm-up → Drop-set → Failure → Normal. */
  cycleSetType: async (setId) => {
    const activeSession = useSessionStore.getState().activeSession;
    const { set: setRow } = findSet(activeSession, setId);
    if (!setRow) throw new Error('workoutOperationsStore.cycleSetType: set not found');
    const idx = SET_CYCLE.indexOf(setRow.set_type);
    const next = SET_CYCLE[(idx + 1) % SET_CYCLE.length];
    const updated = sessionQueries.updateSetType(getDatabase(), setId, next);
    useSessionStore.setState((s) => ({
      activeSession: patchSet(s.activeSession, setId, updated),
    }));
    return updated;
  },

  /** Set the marker directly (normal | warmup | dropset | failure). */
  setSetType: async (setId, setType) => {
    const updated = sessionQueries.updateSetType(getDatabase(), setId, setType);
    useSessionStore.setState((s) => ({
      activeSession: patchSet(s.activeSession, setId, updated),
    }));
    return updated;
  },

  /** Partially update weight / reps / rpe on a set. */
  updateSetFields: async (setId, patch) => {
    const updated = sessionQueries.updateSetFields(getDatabase(), setId, patch);
    useSessionStore.setState((s) => ({
      activeSession: patchSet(s.activeSession, setId, updated),
    }));
    return updated;
  },

  /** Remove a set. */
  deleteSet: async (setId) => {
    sessionQueries.deleteSet(getDatabase(), setId);
    useSessionStore.setState((s) => ({
      activeSession: {
        ...s.activeSession,
        exercises: s.activeSession.exercises.map((e) => ({
          ...e,
          sets: e.sets.filter((set) => set.id !== setId),
        })),
      },
    }));
  },

  // -- supersets ------------------------------------------------------------

  /** Pair workout exercises into a superset (shared rest timer). */
  createSuperset: async (workoutExerciseIds) => {
    const db = getDatabase();
    const session = useSessionStore.getState().activeSession;
    const groupId = sessionQueries.createSuperset(db, session.id, workoutExerciseIds);
    useSessionStore.setState({ activeSession: hydrateActiveSession(db, session.id) });
    return groupId;
  },

  /** Remove a workout_exercise from its superset. */
  removeFromSuperset: async (workoutExerciseId) => {
    const db = getDatabase();
    const session = useSessionStore.getState().activeSession;
    sessionQueries.removeFromSuperset(db, workoutExerciseId);
    useSessionStore.setState({ activeSession: hydrateActiveSession(db, session.id) });
    return useSessionStore.getState().activeSession;
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
}));

// When the session finishes (activeSession → null), clear the rest timer.
// This subscription breaks what would otherwise be a require cycle:
// sessionStore → workoutOperationsStore → sessionStore.
useSessionStore.subscribe((state, prev) => {
  if (state.activeSession === null && prev.activeSession !== null) {
    useWorkoutOperationsStore.setState({ restTimerEndsAt: null, restTimerTotalSeconds: 0 });
  }
});
