import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { initDatabase, resetDatabaseForTesting, getDatabase } from '../../utils/db.js';
import { seedExercises } from '../../db/seed/seed.js';
import { useWorkoutStore } from '../workoutStore.js';
import { useSettingsStore } from '../settingsStore.js';
import { searchExercises, getExerciseById } from '../../db/queries/exerciseQueries.js';

// ---- helpers --------------------------------------------------------------

function findExercise(db, name) {
  const results = searchExercises(db, { query: name, includeArchived: true });
  return results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

// Seed a prior completed session so addSet pre-fill has history.
function logPriorSession(db, exerciseId, sets) {
  db.transaction(() => {
    const s = db.execute(`INSERT INTO workout_session (started_at) VALUES (?) RETURNING id`, [
      '2025-01-01T00:00:00.000Z',
    ]);
    const sessionId = s.rows[0].id;
    const we = db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id) VALUES (?, ?) RETURNING id`,
      [sessionId, exerciseId],
    );
    const workoutExerciseId = we.rows[0].id;
    db.executeBatch(
      sets.map((set, i) => ({
        sql: `INSERT INTO exercise_set
          (workout_exercise_id, sort_order, weight, reps, set_type, is_completed)
          VALUES (?, ?, ?, ?, ?, ?)`,
        params: [workoutExerciseId, i, set.weight, set.reps, set.set_type ?? 'normal', 1],
      })),
    );
    db.execute(`UPDATE workout_session SET finished_at = ?, is_completed = 1 WHERE id = ?`, [
      '2025-01-01T00:30:00.000Z',
      sessionId,
    ]);
  });
}

const INITIAL_STATE = {
  activeSession: null,
  isLoading: false,
  error: null,
  restTimerEndsAt: null,
  restTimerTotalSeconds: 0,
  lastSessionStats: null,
};

function resetStore() {
  useWorkoutStore.setState({
    ...INITIAL_STATE,
  });
}

let db;
beforeEach(() => {
  resetDatabaseForTesting();
  db = initDatabase({ name: ':memory:' });
  seedExercises(db);
  resetStore();
  // settingsStore default rest is 120s; keep it deterministic.
  useSettingsStore.setState({ defaultRestSeconds: 120 });
});
afterEach(() => {
  resetDatabaseForTesting();
});

// ---- tests ----------------------------------------------------------------

describe('workoutStore — startFreeFlow', () => {
  it('creates a WorkoutSession with routine_id = null and empty exercises', async () => {
    const session = await useWorkoutStore.getState().startFreeFlow();
    expect(session.routine_id).toBeNull();
    expect(session.exercises).toEqual([]);
    expect(useWorkoutStore.getState().activeSession).toBe(session);
  });
});

describe('workoutStore — addExercise + pair frequency', () => {
  it('appends an exercise with correct sort_order and embeds the resolved exercise', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const entry = await useWorkoutStore.getState().addExercise(bench.id);
    expect(entry.sort_order).toBe(0);
    expect(entry.exercise.id).toBe(bench.id);
    expect(entry.sets).toEqual([]);
    expect(useWorkoutStore.getState().activeSession.exercises.length).toBe(1);
  });

  it('increments exercise_pair_frequency for (previous, new)', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    await useWorkoutStore.getState().startFreeFlow();
    await useWorkoutStore.getState().addExercise(bench.id);
    await useWorkoutStore.getState().addExercise(curl.id);
    const { rows } = getDatabase().execute(`SELECT count FROM exercise_pair_frequency`);
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(1);
  });
});

describe('workoutStore — addSet (pre-fill + append)', () => {
  it('appends a set with an incrementing sort_order', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const s1 = await useWorkoutStore.getState().addSet(we.id);
    const s2 = await useWorkoutStore.getState().addSet(we.id);
    expect(s1.sort_order).toBe(0);
    expect(s2.sort_order).toBe(1);
    expect(useWorkoutStore.getState().activeSession.exercises[0].sets.length).toBe(2);
  });

  it('pre-fills weight/reps from the last session', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logPriorSession(db, bench.id, [
      { weight: 100, reps: 5 },
      { weight: 102.5, reps: 5 },
    ]);
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const set = await useWorkoutStore.getState().addSet(we.id);
    expect(set.weight).toBe(102.5);
    expect(set.reps).toBe(5);
  });
});

describe('workoutStore — completeSet + rest timer', () => {
  it('sets is_completed and starts the rest timer for a normal set', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const resolved = getExerciseById(db, bench.id);
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const set = await useWorkoutStore.getState().addSet(we.id);
    const completed = await useWorkoutStore.getState().completeSet(set.id);
    expect(completed.is_completed).toBe(1);
    const state = useWorkoutStore.getState();
    expect(state.restTimerEndsAt).not.toBeNull();
    // Hierarchy: exercise.default_rest_seconds wins over app default (120).
    expect(state.restTimerTotalSeconds).toBe(resolved.default_rest_seconds);
  });

  it('does not start the rest timer for a warm-up set', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const set = await useWorkoutStore.getState().addSet(we.id);
    await useWorkoutStore.getState().cycleSetType(set.id); // normal -> warmup
    await useWorkoutStore.getState().completeSet(set.id);
    const state = useWorkoutStore.getState();
    expect(state.restTimerEndsAt).toBeNull();
    expect(state.restTimerTotalSeconds).toBe(0);
  });

  it('rest timer only fires after the last drop in a contiguous drop group', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const s1 = await useWorkoutStore.getState().addSet(we.id);
    const s2 = await useWorkoutStore.getState().addSet(we.id);
    const s3 = await useWorkoutStore.getState().addSet(we.id);
    // s2 and s3 are drop sets (a drop group of 2).
    await useWorkoutStore.getState().cycleSetType(s2.id); // -> warmup
    await useWorkoutStore.getState().cycleSetType(s2.id); // -> dropset
    await useWorkoutStore.getState().cycleSetType(s3.id); // -> warmup
    await useWorkoutStore.getState().cycleSetType(s3.id); // -> dropset

    await useWorkoutStore.getState().completeSet(s2.id); // first drop -> no timer
    expect(useWorkoutStore.getState().restTimerEndsAt).toBeNull();
    await useWorkoutStore.getState().completeSet(s3.id); // last drop -> timer
    expect(useWorkoutStore.getState().restTimerEndsAt).not.toBeNull();
  });

  it('addRestTime extends the running timer; stopRestTimer clears it', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const set = await useWorkoutStore.getState().addSet(we.id);
    await useWorkoutStore.getState().completeSet(set.id);
    const before = useWorkoutStore.getState().restTimerEndsAt;
    await useWorkoutStore.getState().addRestTime(30);
    expect(useWorkoutStore.getState().restTimerEndsAt).toBeGreaterThan(before);
    useWorkoutStore.getState().stopRestTimer();
    expect(useWorkoutStore.getState().restTimerEndsAt).toBeNull();
  });
});

describe('workoutStore — set type cycle', () => {
  it('cycles Normal -> Warm-up -> Drop-set -> Failure -> Normal', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const set = await useWorkoutStore.getState().addSet(we.id);
    const a = await useWorkoutStore.getState().cycleSetType(set.id);
    expect(a.set_type).toBe('warmup');
    const b = await useWorkoutStore.getState().cycleSetType(set.id);
    expect(b.set_type).toBe('dropset');
    const c = await useWorkoutStore.getState().cycleSetType(set.id);
    expect(c.set_type).toBe('failure');
    const d = await useWorkoutStore.getState().cycleSetType(set.id);
    expect(d.set_type).toBe('normal');
  });
});

describe('workoutStore — substitute / remove / reorder / notes', () => {
  it('substituteExercise swaps the exercise and refreshes the embedded row', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    await useWorkoutStore.getState().substituteExercise(we.id, curl.id);
    const entry = useWorkoutStore.getState().activeSession.exercises[0];
    expect(entry.exercise.id).toBe(curl.id);
  });

  it('removeWorkoutExercise drops the entry and its sets', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    await useWorkoutStore.getState().addSet(we.id);
    await useWorkoutStore.getState().removeWorkoutExercise(we.id);
    expect(useWorkoutStore.getState().activeSession.exercises.length).toBe(0);
  });

  it('reorderExercises rewrites sort_order in the given order', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const squat = findExercise(db, 'Barbell Squat');
    await useWorkoutStore.getState().startFreeFlow();
    const a = await useWorkoutStore.getState().addExercise(bench.id);
    const b = await useWorkoutStore.getState().addExercise(curl.id);
    const c = await useWorkoutStore.getState().addExercise(squat.id);
    await useWorkoutStore.getState().reorderExercises([c.id, a.id, b.id]);
    const ids = useWorkoutStore.getState().activeSession.exercises.map((e) => e.id);
    expect(ids).toEqual([c.id, a.id, b.id]);
  });

  it('setExerciseNotes stores notes on the workout exercise', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    await useWorkoutStore.getState().setExerciseNotes(we.id, 'Paused at bottom');
    expect(useWorkoutStore.getState().activeSession.exercises[0].notes).toBe('Paused at bottom');
  });
});

describe('workoutStore — supersets', () => {
  it('createSuperset pairs two exercises; shared rest timer fires after both complete', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    await useWorkoutStore.getState().startFreeFlow();
    const a = await useWorkoutStore.getState().addExercise(bench.id);
    const b = await useWorkoutStore.getState().addExercise(curl.id);
    await useWorkoutStore.getState().createSuperset([a.id, b.id]);
    expect(useWorkoutStore.getState().activeSession.exercises[0].supersetGroupId).not.toBeNull();

    const aSet = await useWorkoutStore.getState().addSet(a.id);
    const bSet = await useWorkoutStore.getState().addSet(b.id);
    await useWorkoutStore.getState().completeSet(aSet.id); // partner not done -> no timer
    expect(useWorkoutStore.getState().restTimerEndsAt).toBeNull();
    await useWorkoutStore.getState().completeSet(bSet.id); // both done -> shared timer
    expect(useWorkoutStore.getState().restTimerEndsAt).not.toBeNull();
  });

  it('removeFromSuperset clears the group tag', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    await useWorkoutStore.getState().startFreeFlow();
    const a = await useWorkoutStore.getState().addExercise(bench.id);
    const b = await useWorkoutStore.getState().addExercise(curl.id);
    await useWorkoutStore.getState().createSuperset([a.id, b.id]);
    await useWorkoutStore.getState().removeFromSuperset(a.id);
    expect(useWorkoutStore.getState().activeSession.exercises[0].supersetGroupId).toBeNull();
  });
});

describe('workoutStore — resumeInterrupted + persistence', () => {
  it('resumeInterrupted reloads an unfinished session with its exercises + sets', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    await useWorkoutStore.getState().addSet(we.id);
    await useWorkoutStore.getState().addSet(we.id);

    // Simulate an app restart: wipe in-memory state, DB persists.
    useWorkoutStore.setState({ activeSession: null });
    const resumed = await useWorkoutStore.getState().resumeInterrupted();
    expect(resumed).not.toBeNull();
    expect(resumed.exercises.length).toBe(1);
    expect(resumed.exercises[0].sets.length).toBe(2);
    expect(useWorkoutStore.getState().activeSession).toBe(resumed);
  });

  it('resumeInterrupted returns null when nothing is unfinished', async () => {
    const resumed = await useWorkoutStore.getState().resumeInterrupted();
    expect(resumed).toBeNull();
    expect(useWorkoutStore.getState().activeSession).toBeNull();
  });
});

describe('workoutStore — finishWorkout', () => {
  it('finishes the session, reports stats, clears the active session + timer', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    await useWorkoutStore.getState().startFreeFlow();
    const we = await useWorkoutStore.getState().addExercise(bench.id);
    const s1 = await useWorkoutStore.getState().addSet(we.id);
    await useWorkoutStore.getState().updateSetFields(s1.id, { weight: 100, reps: 5 });
    await useWorkoutStore.getState().completeSet(s1.id);
    const stats = await useWorkoutStore.getState().finishWorkout();
    expect(stats.volume).toBe(500);
    expect(stats.exerciseCount).toBe(1);
    expect(useWorkoutStore.getState().activeSession).toBeNull();
    expect(useWorkoutStore.getState().restTimerEndsAt).toBeNull();
    expect(useWorkoutStore.getState().lastSessionStats).toEqual(stats);
    // DB reflects completion.
    const { rows } = getDatabase().execute(`SELECT is_completed FROM workout_session ORDER BY id DESC LIMIT 1`);
    expect(rows[0].is_completed).toBe(1);
  });
});