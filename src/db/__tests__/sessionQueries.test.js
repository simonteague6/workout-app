import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises } from '../seed/seed.js';
import {
  createSession,
  getActiveSession,
  addWorkoutExercise,
  incrementPairFrequency,
  getExerciseSuggestions,
  addSet,
  getPreviousSetForExercise,
  completeSet,
  updateSetType,
  updateSetFields,
  deleteSet,
  getSetsForWorkoutExercise,
  getWorkoutExercisesForSession,
  getSessionDetail,
  substituteExercise,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  setWorkoutExerciseNotes,
  createSuperset,
  getSupersetGroups,
  removeFromSuperset,
  finishSession,
  getSessionStats,
  getVolumeForSession,
} from '../queries/sessionQueries.js';
import { searchExercises } from '../queries/exerciseQueries.js';

// ---- helpers --------------------------------------------------------------
function findExercise(db, name) {
  // Exact match preferred; fall back to the top query result (searchExercises
  // already ranks by usage then name) so a seed without an exact "Barbell
  // Bench Press" (it ships "Barbell Bench Press - Medium Grip") still resolves.
  const results = searchExercises(db, { query: name, includeArchived: true });
  return results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

// Seed a *prior* completed session for one exercise with the given sets, so
// addSet pre-fill + stats tests have history to read from.
function logPriorSession(db, exerciseId, sets, { startedAt } = {}) {
  db.transaction(() => {
    const s = db.execute(
      startedAt
        ? `INSERT INTO workout_session (started_at) VALUES (?) RETURNING id`
        : `INSERT INTO workout_session DEFAULT VALUES RETURNING id`,
      startedAt ? [startedAt] : [],
    );
    const sessionId = s.rows[0].id;
    const we = db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id) VALUES (?, ?) RETURNING id`,
      [sessionId, exerciseId],
    );
    const workoutExerciseId = we.rows[0].id;
    if (sets && sets.length) {
      db.executeBatch(
        sets.map((set, i) => ({
          sql: `INSERT INTO exercise_set
            (workout_exercise_id, sort_order, weight, reps, set_type, is_completed)
            VALUES (?, ?, ?, ?, ?, ?)`,
          params: [workoutExerciseId, i, set.weight, set.reps, set.set_type ?? 'normal', set.is_completed ?? 1],
        })),
      );
    }
    db.execute(`UPDATE workout_session SET finished_at = ?, is_completed = 1 WHERE id = ?`, [
      startedAt ?? '2025-01-01T00:30:00.000Z',
      sessionId,
    ]);
  });
}

let db;
beforeEach(() => {
  db = createInMemoryDb();
  seedExercises(db);
});
afterEach(() => db.close());

// ---- tests ----------------------------------------------------------------

describe('sessionQueries — createSession / getActiveSession', () => {
  it('startFreeFlow creates a WorkoutSession with routine_id = null', () => {
    const session = createSession(db);
    expect(session.id).toBeGreaterThan(0);
    expect(session.routine_id).toBeNull();
    expect(session.is_completed).toBe(0);
    expect(session.finished_at).toBeNull();
    expect(session.started_at).toBeTruthy();
  });

  it('createSession with routineId links the routine', () => {
    db.execute(`INSERT INTO routine (name) VALUES ('Push A') RETURNING id`);
    const routineId = db.execute(`SELECT id FROM routine WHERE name = 'Push A'`).rows[0].id;
    const session = createSession(db, { routineId });
    expect(session.routine_id).toBe(routineId);
  });

  it('getActiveSession returns null when no unfinished session exists', () => {
    expect(getActiveSession(db)).toBeNull();
  });

  it('getActiveSession returns the most recent unfinished session; finished excluded', () => {
    createSession(db, { startedAt: '2025-01-01T00:00:00.000Z' });
    const recent = createSession(db, { startedAt: '2025-02-01T00:00:00.000Z' });
    const active = getActiveSession(db);
    expect(active.id).toBe(recent.id);
    finishSession(db, recent.id);
    // The older, still-open session becomes active.
    expect(getActiveSession(db).is_completed).toBe(0);
  });
});

describe('sessionQueries — addWorkoutExercise + pair frequency', () => {
  it('creates a WorkoutExercise with correct sort_order', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    const we1 = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const we2 = addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    expect(we1.sort_order).toBe(0);
    expect(we2.sort_order).toBe(1);
    expect(we1.exercise_id).toBe(bench.id);
  });

  it('increments exercise_pair_frequency for (previous_exercise, new_exercise)', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });

    const { rows } = db.execute(`SELECT * FROM exercise_pair_frequency`);
    expect(rows.length).toBe(1);
    const [a, b] = [rows[0].exercise_a_id, rows[0].exercise_b_id].sort((x, y) => x - y);
    expect([a, b]).toEqual([Math.min(bench.id, curl.id), Math.max(bench.id, curl.id)]);
    expect(rows[0].count).toBe(1);
  });

  it('first exercise in a session does not create a pair (no previous)', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const { rows } = db.execute(`SELECT * FROM exercise_pair_frequency`);
    expect(rows.length).toBe(0);
  });

  it('accumulates pair counts across sessions (canonical a<b storage)', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    for (let i = 0; i < 3; i++) {
      const session = createSession(db);
      addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
      addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    }
    const { rows } = db.execute(`SELECT count FROM exercise_pair_frequency`);
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(3);
  });

  it('incrementPairFrequency canonicalizes order and skips self-pairs', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    incrementPairFrequency(db, curl.id, bench.id); // reversed -> stored a<b
    incrementPairFrequency(db, bench.id, curl.id); // count climbs to 2
    const row = db.execute(`SELECT * FROM exercise_pair_frequency`).rows[0];
    expect([row.exercise_a_id, row.exercise_b_id]).toEqual([
      Math.min(bench.id, curl.id),
      Math.max(bench.id, curl.id),
    ]);
    incrementPairFrequency(db, bench.id, bench.id); // self-pair skipped
    const { rows } = db.execute(`SELECT * FROM exercise_pair_frequency`);
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(2);
  });
});

describe('sessionQueries — getExerciseSuggestions (pair-frequency DESC)', () => {
  it('ranks exercises by pair frequency with the last exercise, DESC', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const squat = findExercise(db, 'Barbell Squat') ?? searchExercises(db)[0];
    incrementPairFrequency(db, bench.id, curl.id);
    incrementPairFrequency(db, bench.id, curl.id);
    incrementPairFrequency(db, bench.id, curl.id);
    incrementPairFrequency(db, bench.id, squat.id);

    const suggestions = getExerciseSuggestions(db, { lastExerciseId: bench.id });
    const curlIdx = suggestions.findIndex((e) => e.id === curl.id);
    const squatIdx = suggestions.findIndex((e) => e.id === squat.id);
    expect(curlIdx).toBeGreaterThanOrEqual(0);
    expect(squatIdx).toBeGreaterThan(curlIdx);
  });

  it('falls back to usage-frequency ordering when no last exercise', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logPriorSession(db, bench.id, [{ weight: 100, reps: 5 }]);
    const suggestions = getExerciseSuggestions(db, { lastExerciseId: null });
    const benchRow = suggestions.find((e) => e.id === bench.id);
    expect(benchRow).toBeDefined();
    // Used exercise ranks before never-used ones.
    const neverIdx = suggestions.findIndex((e) => e.usage_count === 0);
    expect(suggestions.indexOf(benchRow)).toBeLessThan(neverIdx);
  });

  it('filters by name fragment and excludes archived', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const results = getExerciseSuggestions(db, { lastExerciseId: bench.id, query: 'curl' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.name.toLowerCase().includes('curl'))).toBe(true);
    db.execute(`UPDATE exercise SET is_archived = 1 WHERE id = ?`, [bench.id]);
    const after = getExerciseSuggestions(db, { lastExerciseId: bench.id, query: 'bench' });
    expect(after.find((e) => e.id === bench.id)).toBeUndefined();
  });
});

describe('sessionQueries — addSet (pre-fill from last session)', () => {
  it('creates an ExerciseSet with sort_order incrementing', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const s1 = addSet(db, { workoutExerciseId: we.id });
    const s2 = addSet(db, { workoutExerciseId: we.id });
    expect(s1.sort_order).toBe(0);
    expect(s2.sort_order).toBe(1);
    expect(s1.is_completed).toBe(0);
  });

  it('pre-fills weight/reps from the last completed set of that exercise', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logPriorSession(db, bench.id, [
      { weight: 100, reps: 5 },
      { weight: 102.5, reps: 5 },
    ]);
    const session = createSession(db, { startedAt: '2025-06-01T00:00:00.000Z' });
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    expect(set.weight).toBe(102.5);
    expect(set.reps).toBe(5);
  });

  it('leaves weight/reps null when no prior history exists', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    expect(set.weight).toBeNull();
    expect(set.reps).toBeNull();
  });

  it('does not pre-fill from warm-up sets', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logPriorSession(db, bench.id, [
      { weight: 50, reps: 10, set_type: 'warmup' },
      { weight: 100, reps: 5 },
    ]);
    const session = createSession(db, { startedAt: '2025-06-01T00:00:00.000Z' });
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    expect(set.weight).toBe(100);
    expect(set.reps).toBe(5);
  });

  it('getPreviousSetForExercise returns the most recent completed non-warmup set', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logPriorSession(db, bench.id, [{ weight: 80, reps: 8 }], { startedAt: '2025-01-01T00:00:00.000Z' });
    logPriorSession(db, bench.id, [{ weight: 90, reps: 6 }], { startedAt: '2025-03-01T00:00:00.000Z' });
    const prev = getPreviousSetForExercise(db, bench.id);
    expect(prev.weight).toBe(90);
    expect(prev.reps).toBe(6);
  });
});

describe('sessionQueries — completeSet + set type', () => {
  it('completeSet sets is_completed and stores rest_timer_duration', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    const completed = completeSet(db, set.id, { restDuration: 90 });
    expect(completed.is_completed).toBe(1);
    expect(completed.rest_timer_duration).toBe(90);
  });

  it('updateSetType validates the marker enum', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    const updated = updateSetType(db, set.id, 'warmup');
    expect(updated.set_type).toBe('warmup');
    expect(() => updateSetType(db, set.id, 'bogus')).toThrow();
  });

  it('updateSetFields writes weight/reps/rpe partially', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    const updated = updateSetFields(db, set.id, { weight: 110, reps: 5, rpe: 8 });
    expect(updated.weight).toBe(110);
    expect(updated.reps).toBe(5);
    expect(updated.rpe).toBe(8);
  });

  it('deleteSet removes the row', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const set = addSet(db, { workoutExerciseId: we.id });
    deleteSet(db, set.id);
    expect(getSetsForWorkoutExercise(db, we.id).length).toBe(0);
  });
});

describe('sessionQueries — session detail + exercise listing', () => {
  it('getSessionDetail returns the session with exercises and their sets', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    const we1 = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const we2 = addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    addSet(db, { workoutExerciseId: we1.id });
    addSet(db, { workoutExerciseId: we1.id });
    addSet(db, { workoutExerciseId: we2.id });

    const detail = getSessionDetail(db, session.id);
    expect(detail.id).toBe(session.id);
    expect(detail.exercises.length).toBe(2);
    expect(detail.exercises[0].exercise.name).toBe(bench.name);
    expect(detail.exercises[0].sets.length).toBe(2);
    expect(detail.exercises[1].sets.length).toBe(1);
    expect(detail.exercises[0].supersetGroupId).toBeNull();
  });

  it('getWorkoutExercisesForSession is ordered by sort_order with resolved names', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    const list = getWorkoutExercisesForSession(db, session.id);
    expect(list.map((e) => e.exercise_id)).toEqual([bench.id, curl.id]);
    expect(list[0].name).toBe(bench.name);
  });
});

describe('sessionQueries — substitute / remove / reorder / notes', () => {
  it('substituteExercise swaps the exercise_id on the workout_exercise', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const updated = substituteExercise(db, we.id, curl.id);
    expect(updated.exercise_id).toBe(curl.id);
  });

  it('removeWorkoutExercise cascades to its sets', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    addSet(db, { workoutExerciseId: we.id });
    removeWorkoutExercise(db, we.id);
    expect(getSetsForWorkoutExercise(db, we.id).length).toBe(0);
    expect(getWorkoutExercisesForSession(db, session.id).length).toBe(0);
  });

  it('reorderWorkoutExercises rewrites sort_order in the given order', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const squat = findExercise(db, 'Barbell Squat') ?? searchExercises(db)[2];
    const session = createSession(db);
    const a = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const b = addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    const c = addWorkoutExercise(db, { sessionId: session.id, exerciseId: squat.id });
    reorderWorkoutExercises(db, session.id, [c.id, a.id, b.id]);
    const list = getWorkoutExercisesForSession(db, session.id);
    expect(list.map((e) => e.id)).toEqual([c.id, a.id, b.id]);
    expect(list.map((e) => e.sort_order)).toEqual([0, 1, 2]);
  });

  it('setWorkoutExerciseNotes stores notes on the workout_exercise', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const updated = setWorkoutExerciseNotes(db, we.id, 'Slow tempo');
    expect(updated.notes).toBe('Slow tempo');
  });
});

describe('sessionQueries — supersets', () => {
  it('createSuperset pairs two exercises and exposes the group', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    const a = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const b = addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    const groupId = createSuperset(db, session.id, [a.id, b.id]);
    expect(groupId).toBeGreaterThan(0);
    const groups = getSupersetGroups(db, session.id);
    expect(groups.length).toBe(1);
    expect(groups[0].workoutExerciseIds.sort((x, y) => x - y)).toEqual([a.id, b.id].sort((x, y) => x - y));
  });

  it('getSessionDetail tags superset members with their group id', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    const a = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const b = addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    const groupId = createSuperset(db, session.id, [a.id, b.id]);
    const detail = getSessionDetail(db, session.id);
    expect(detail.exercises.find((e) => e.id === a.id).supersetGroupId).toBe(groupId);
    expect(detail.exercises.find((e) => e.id === b.id).supersetGroupId).toBe(groupId);
  });

  it('removeFromSuperset removes the member and empties the group', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const curl = findExercise(db, 'Barbell Curl');
    const session = createSession(db);
    const a = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const b = addWorkoutExercise(db, { sessionId: session.id, exerciseId: curl.id });
    createSuperset(db, session.id, [a.id, b.id]);
    removeFromSuperset(db, a.id);
    const groups = getSupersetGroups(db, session.id);
    // Remaining group still contains b.
    expect(groups.length).toBe(1);
    expect(groups[0].workoutExerciseIds).toEqual([b.id]);
  });
});

describe('sessionQueries — finishSession + stats', () => {
  it('finishSession sets finished_at and is_completed', () => {
    const session = createSession(db);
    const finished = finishSession(db, session.id);
    expect(finished.is_completed).toBe(1);
    expect(finished.finished_at).toBeTruthy();
  });

  it('getSessionStats reports volume excluding warm-up sets', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const s1 = addSet(db, { workoutExerciseId: we.id });
    updateSetFields(db, s1.id, { weight: 100, reps: 5 });
    completeSet(db, s1.id);
    const s2 = addSet(db, { workoutExerciseId: we.id });
    updateSetType(db, s2.id, 'warmup');
    updateSetFields(db, s2.id, { weight: 50, reps: 10 });
    completeSet(db, s2.id);
    const s3 = addSet(db, { workoutExerciseId: we.id });
    updateSetFields(db, s3.id, { weight: 110, reps: 3 });
    completeSet(db, s3.id);

    const stats = getSessionStats(db, session.id);
    // 100*5 + 110*3 = 830 (warm-up 50*10 excluded)
    expect(stats.volume).toBe(830);
    expect(stats.exerciseCount).toBe(1);
    expect(stats.setCount).toBe(3);
  });

  it('getVolumeForSession excludes warm-up and uncompleted sets', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db);
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const s1 = addSet(db, { workoutExerciseId: we.id });
    updateSetFields(db, s1.id, { weight: 100, reps: 5 });
    completeSet(db, s1.id);
    const s2 = addSet(db, { workoutExerciseId: we.id }); // uncompleted
    updateSetFields(db, s2.id, { weight: 200, reps: 5 });
    expect(getVolumeForSession(db, session.id)).toBe(500);
  });

  it('getSessionStats duration is non-negative once finished', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const session = createSession(db, { startedAt: '2025-01-01T00:00:00.000Z' });
    const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: bench.id });
    const s = addSet(db, { workoutExerciseId: we.id });
    completeSet(db, s.id);
    finishSession(db, session.id);
    const stats = getSessionStats(db, session.id);
    expect(stats.durationSeconds).toBeGreaterThanOrEqual(0);
  });
});