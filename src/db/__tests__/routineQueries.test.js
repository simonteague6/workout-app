import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises } from '../seed/seed.js';
import * as routineQueries from '../queries/routineQueries.js';
import { searchExercises } from '../queries/exerciseQueries.js';
import {
  createSession,
  addWorkoutExercise,
  addSet,
  finishSession,
} from '../queries/sessionQueries.js';

// ---- helpers --------------------------------------------------------------

function findExercise(db, name) {
  const results = searchExercises(db, { query: name, includeArchived: true });
  return results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

// Build a routine from an ordered list of { exercise, targetSets, repsMin, repsMax, rest }.
function buildRoutineInput(db, items) {
  return items.map((it) => ({
    exerciseId: findExercise(db, it.exercise).id,
    targetSets: it.targetSets ?? 3,
    targetRepsMin: it.repsMin ?? 5,
    targetRepsMax: it.repsMax ?? 12,
    targetRestSeconds: it.rest ?? 90,
  }));
}

// Log a completed prior session for one exercise with the given sets, so the
// routine preview has "last session performance" to read.
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
    return sessionId;
  });
}

let db;
beforeEach(() => {
  db = createInMemoryDb();
  seedExercises(db);
});
afterEach(() => db.close());

// ---- tests ----------------------------------------------------------------

describe('routineQueries — folders', () => {
  it('createFolder inserts a folder and returns it; getFolders lists by sort_order', () => {
    const a = routineQueries.createFolder(db, 'Push Pull Legs');
    routineQueries.createFolder(db, 'Upper Lower');
    expect(a.id).toBeGreaterThan(0);
    expect(a.name).toBe('Push Pull Legs');
    const folders = routineQueries.getFolders(db);
    expect(folders.map((f) => f.name)).toEqual(['Push Pull Legs', 'Upper Lower']);
    expect(folders[0].sort_order).toBeLessThanOrEqual(folders[1].sort_order);
  });

  it('createFolder trims the name and rejects empty names', () => {
    const f = routineQueries.createFolder(db, '  PPL  ');
    expect(f.name).toBe('PPL');
    expect(() => routineQueries.createFolder(db, '   ')).toThrow();
  });
});

describe('routineQueries — createRoutine + routine exercises', () => {
  it('createRoutine inserts a routine + routine_exercise rows with correct sort_order', () => {
    const folder = routineQueries.createFolder(db, 'PPL');
    const input = buildRoutineInput(db, [
      { exercise: 'Barbell Bench Press', targetSets: 4, repsMin: 5, repsMax: 8, rest: 180 },
      { exercise: 'Incline Dumbbell Press', targetSets: 3 },
    ]);
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      folderId: folder.id,
      exercises: input,
    });
    expect(routine.id).toBeGreaterThan(0);
    expect(routine.name).toBe('Push A');
    expect(routine.folder_id).toBe(folder.id);

    const detail = routineQueries.getRoutineDetail(db, routine.id);
    expect(detail.exercises).toHaveLength(2);
    expect(detail.exercises[0].exercise_id).toBe(input[0].exerciseId);
    expect(detail.exercises[0].sort_order).toBe(0);
    expect(detail.exercises[0].target_sets).toBe(4);
    expect(detail.exercises[0].target_reps_min).toBe(5);
    expect(detail.exercises[0].target_reps_max).toBe(8);
    expect(detail.exercises[0].target_rest_seconds).toBe(180);
    expect(detail.exercises[0].exercise_name).toBeTruthy();
    expect(detail.exercises[1].sort_order).toBe(1);
  });

  it('createRoutine with no folderId creates an unfiled routine', () => {
    const routine = routineQueries.createRoutine(db, {
      name: 'Ad-hoc',
      exercises: [],
    });
    expect(routine.folder_id).toBeNull();
    expect(routineQueries.getRoutineDetail(db, routine.id).exercises).toEqual([]);
  });

  it('createRoutine rejects an empty name', () => {
    expect(() =>
      routineQueries.createRoutine(db, { name: '  ', exercises: [] }),
    ).toThrow();
  });

  it('getRoutines lists routines with folder + exercise count, ordered', () => {
    const folder = routineQueries.createFolder(db, 'PPL');
    const r1 = routineQueries.createRoutine(db, {
      name: 'Push A',
      folderId: folder.id,
      exercises: buildRoutineInput(db, [{ exercise: 'Barbell Bench Press' }]),
    });
    const r2 = routineQueries.createRoutine(db, {
      name: 'Pull A',
      folderId: folder.id,
      exercises: buildRoutineInput(db, [
        { exercise: 'Pullups' },
        { exercise: 'Bent Over Barbell Row' },
      ]),
    });
    const routines = routineQueries.getRoutines(db);
    expect(routines).toHaveLength(2);
    expect(routines.map((r) => r.name)).toContain('Push A');
    const pushA = routines.find((r) => r.id === r1.id);
    expect(pushA.folder_name).toBe('PPL');
    expect(pushA.exercise_count).toBe(1);
    const pullA = routines.find((r) => r.id === r2.id);
    expect(pullA.exercise_count).toBe(2);
  });
});

describe('routineQueries — edit + reorder + move + delete', () => {
  it('setRoutineExercises replaces the routine_exercise rows with new targets + order', () => {
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      exercises: buildRoutineInput(db, [
        { exercise: 'Barbell Bench Press', targetSets: 4 },
        { exercise: 'Incline Dumbbell Press', targetSets: 3 },
      ]),
    });
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    const benchId = detail.exercises[0].exercise_id;
    const squatId = findExercise(db, 'Barbell Squat').id;
    // New list: squat first (3 sets), bench second (5 sets).
    routineQueries.setRoutineExercises(db, routine.id, [
      { exerciseId: squatId, targetSets: 3, targetRepsMin: 5, targetRepsMax: 5, targetRestSeconds: 120 },
      { exerciseId: benchId, targetSets: 5, targetRepsMin: 3, targetRepsMax: 6, targetRestSeconds: 180 },
    ]);
    const after = routineQueries.getRoutineDetail(db, routine.id);
    expect(after.exercises).toHaveLength(2);
    expect(after.exercises[0].exercise_id).toBe(squatId);
    expect(after.exercises[0].target_sets).toBe(3);
    expect(after.exercises[1].exercise_id).toBe(benchId);
    expect(after.exercises[1].target_sets).toBe(5);
  });

  it('renameRoutine updates the name; moveRoutineToFolder updates the folder', () => {
    const f1 = routineQueries.createFolder(db, 'PPL');
    const f2 = routineQueries.createFolder(db, 'Strength');
    const r = routineQueries.createRoutine(db, { name: 'Push A', folderId: f1.id, exercises: [] });
    const renamed = routineQueries.renameRoutine(db, r.id, 'Push Day');
    expect(renamed.name).toBe('Push Day');
    const moved = routineQueries.moveRoutineToFolder(db, r.id, f2.id);
    expect(moved.folder_id).toBe(f2.id);
    // folderId null moves to unfiled
    const unfiled = routineQueries.moveRoutineToFolder(db, r.id, null);
    expect(unfiled.folder_id).toBeNull();
  });

  it('reorderRoutineExercises rewrites sort_order in the given order', () => {
    const routine = routineQueries.createRoutine(db, {
      name: 'R',
      exercises: buildRoutineInput(db, [
        { exercise: 'Barbell Bench Press' },
        { exercise: 'Pullups' },
        { exercise: 'Barbell Squat' },
      ]),
    });
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    const ids = detail.exercises.map((e) => e.id);
    const reordered = [ids[2], ids[0], ids[1]];
    routineQueries.reorderRoutineExercises(db, routine.id, reordered);
    const after = routineQueries.getRoutineDetail(db, routine.id);
    expect(after.exercises.map((e) => e.id)).toEqual(reordered);
    expect(after.exercises.map((e) => e.sort_order)).toEqual([0, 1, 2]);
  });

  it('deleteRoutine removes the routine and cascades to routine_exercise', () => {
    const routine = routineQueries.createRoutine(db, {
      name: 'R',
      exercises: buildRoutineInput(db, [{ exercise: 'Barbell Bench Press' }]),
    });
    routineQueries.deleteRoutine(db, routine.id);
    expect(routineQueries.getRoutineDetail(db, routine.id)).toBeNull();
    expect(db.execute(`SELECT COUNT(*) AS c FROM routine_exercise WHERE routine_id = ?`, [routine.id]).rows[0].c).toBe(0);
  });
});

describe('routineQueries — routine preview (last session performance)', () => {
  it('getRoutinePreview returns each exercise + the last completed session that used it', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    // Two prior sessions for bench: older then newer.
    logPriorSession(db, bench.id, [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }], {
      startedAt: '2025-01-01T00:00:00.000Z',
    });
    logPriorSession(db, bench.id, [{ weight: 85, reps: 5 }], {
      startedAt: '2025-02-01T00:00:00.000Z',
    });
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      exercises: buildRoutineInput(db, [
        { exercise: 'Barbell Bench Press', targetSets: 4 },
        { exercise: 'Barbell Curl', targetSets: 3 },
      ]),
    });
    const preview = routineQueries.getRoutinePreview(db, routine.id);
    expect(preview.exercises).toHaveLength(2);
    const benchRow = preview.exercises[0];
    expect(benchRow.lastSession).not.toBeNull();
    expect(benchRow.lastSession.started_at).toBe('2025-02-01T00:00:00.000Z');
    expect(benchRow.lastSession.sets.map((s) => s.weight)).toEqual([85]);
    const curlRow = preview.exercises[1];
    // Curl has no history.
    expect(curlRow.lastSession).toBeNull();
  });
});

describe('routineQueries — routine vs session diff', () => {
  function startRoutineSession(db, routineId, { skip = [], substitutions = [], extras = [] } = {}) {
    const detail = routineQueries.getRoutineDetail(db, routineId);
    const session = createSession(db, { routineId });
    const sessionId = session.id;
    detail.exercises.forEach((re) => {
      if (skip.includes(re.id)) return;
      const sub = substitutions.find((s) => s.fromReId === re.id);
      const exerciseId = sub ? sub.exerciseId : re.exercise_id;
      const { rows } = db.execute(
        `INSERT INTO workout_exercise
           (session_id, exercise_id, sort_order, substituted_from_routine_exercise_id)
         VALUES (?, ?, ?, ?) RETURNING id`,
        [sessionId, exerciseId, re.sort_order, re.id],
      );
      // Add one completed set so the exercise counts as "performed" in the diff.
      db.execute(
        `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps, is_completed)
         VALUES (?, 0, 50, 8, 1)`,
        [rows[0].id],
      );
    });
    extras.forEach((ex) => {
      const { rows } = db.execute(
        `INSERT INTO workout_exercise (session_id, exercise_id, sort_order) VALUES (?, ?, ?) RETURNING id`,
        [sessionId, ex.exerciseId, 99 + ex.exerciseId],
      );
      // Add one completed set so the extra shows as "added" in the diff.
      db.execute(
        `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps, is_completed)
         VALUES (?, 0, 40, 10, 1)`,
        [rows[0].id],
      );
    });
    return sessionId;
  }

  it('marks matched, substituted, and skipped exercises', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const incline = findExercise(db, 'Incline Dumbbell Press');
    const curl = findExercise(db, 'Barbell Curl');
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      exercises: buildRoutineInput(db, [
        { exercise: 'Barbell Bench Press' },
        { exercise: 'Incline Dumbbell Press' },
        { exercise: 'Barbell Curl' },
      ]),
    });
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    const inclineRe = detail.exercises.find((e) => e.exercise_id === incline.id);
    const curlRe = detail.exercises.find((e) => e.exercise_id === curl.id);
    const sessionId = startRoutineSession(db, routine.id, {
      skip: [curlRe.id],
      substitutions: [{ fromReId: inclineRe.id, exerciseId: bench.id }],
    });

    const diff = routineQueries.getRoutineSessionDiff(db, routine.id, sessionId);
    const byType = (t) => diff.filter((d) => d.type === t);
    expect(byType('matched').length).toBe(1);
    expect(byType('substituted').length).toBe(1);
    expect(byType('skipped').length).toBe(1);
    const sub = byType('substituted')[0];
    expect(sub.routineExerciseId).toBe(inclineRe.id);
    expect(sub.routineExerciseName).toBe('Incline Dumbbell Press');
    expect(sub.substituteExerciseId).toBe(bench.id);
    expect(sub.substituteExerciseName).toBe(bench.name);
    const skipped = byType('skipped')[0];
    expect(skipped.routineExerciseName).toBe('Barbell Curl');
  });

  it('flags added exercises that were not part of the routine', () => {
    const squat = findExercise(db, 'Barbell Squat');
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      exercises: buildRoutineInput(db, [{ exercise: 'Barbell Bench Press' }]),
    });
    const sessionId = startRoutineSession(db, routine.id, {
      extras: [{ exerciseId: squat.id }],
    });
    const diff = routineQueries.getRoutineSessionDiff(db, routine.id, sessionId);
    const added = diff.find((d) => d.type === 'added');
    expect(added).toBeDefined();
    expect(added.exerciseId).toBe(squat.id);
    expect(added.exerciseName).toBe('Barbell Squat');
  });

  it('marks a pre-loaded exercise with zero completed sets as skipped', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      exercises: buildRoutineInput(db, [{ exercise: 'Barbell Bench Press' }]),
    });
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    // Start from routine: workout_exercise is created with origin link, but no sets completed.
    const sessionId = createSession(db, { routineId: routine.id }).id;
    db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id, sort_order, substituted_from_routine_exercise_id)
       VALUES (?, ?, 0, ?)`,
      [sessionId, bench.id, detail.exercises[0].id],
    );
    const diff = routineQueries.getRoutineSessionDiff(db, routine.id, sessionId);
    expect(diff.filter((d) => d.type === 'matched')).toHaveLength(0);
    expect(diff.filter((d) => d.type === 'skipped')).toHaveLength(1);
  });
});

describe('routineQueries — save-as-new + update-template-from-session', () => {
  function logCompletedSession(db, exercisesWithSets, { startedAt } = {}) {
    // exercisesWithSets: [{ exerciseId, sets: [{ weight, reps }] }]
    const session = createSession(db, { startedAt });
    for (const item of exercisesWithSets) {
      const we = addWorkoutExercise(db, { sessionId: session.id, exerciseId: item.exerciseId });
      for (let i = 0; i < item.sets.length; i++) {
        const set = addSet(db, { workoutExerciseId: we.id });
        const updated = db.execute(
          `UPDATE exercise_set SET weight = ?, reps = ?, is_completed = 1 WHERE id = ? RETURNING *`,
          [item.sets[i].weight, item.sets[i].reps, set.id],
        ).rows[0];
        void updated;
      }
    }
    finishSession(db, session.id);
    return session.id;
  }

  it('saveSessionAsNewRoutine creates a routine + routine_exercise rows from the session', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const squat = findExercise(db, 'Barbell Squat');
    const folder = routineQueries.createFolder(db, 'PPL');
    const sessionId = logCompletedSession(db, [
      { exerciseId: bench.id, sets: [{ weight: 80, reps: 8 }, { weight: 85, reps: 5 }] },
      { exerciseId: squat.id, sets: [{ weight: 100, reps: 5 }] },
    ]);
    const routine = routineQueries.saveSessionAsNewRoutine(db, sessionId, 'My Push', folder.id);
    expect(routine.id).toBeGreaterThan(0);
    expect(routine.name).toBe('My Push');
    expect(routine.folder_id).toBe(folder.id);
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    expect(detail.exercises).toHaveLength(2);
    expect(detail.exercises[0].exercise_id).toBe(bench.id);
    expect(detail.exercises[0].target_sets).toBe(2);
    expect(detail.exercises[0].target_reps_min).toBe(5);
    expect(detail.exercises[0].target_reps_max).toBe(8);
    expect(detail.exercises[1].exercise_id).toBe(squat.id);
    expect(detail.exercises[1].target_sets).toBe(1);
  });

  it('updateRoutineFromSession replaces the routine_exercise rows with today\u2019s actuals', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const squat = findExercise(db, 'Barbell Squat');
    const routine = routineQueries.createRoutine(db, {
      name: 'Old Push',
      exercises: buildRoutineInput(db, [
        { exercise: 'Barbell Bench Press', targetSets: 4, repsMin: 5, repsMax: 5 },
      ]),
    });
    // Today: bench 3 sets (3,6,10 reps) + squat added.
    const sessionId = logCompletedSession(db, [
      { exerciseId: bench.id, sets: [{ weight: 80, reps: 3 }, { weight: 80, reps: 6 }, { weight: 80, reps: 10 }] },
      { exerciseId: squat.id, sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
    ]);
    routineQueries.updateRoutineFromSession(db, routine.id, sessionId);
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    expect(detail.exercises).toHaveLength(2);
    expect(detail.exercises[0].exercise_id).toBe(bench.id);
    expect(detail.exercises[0].target_sets).toBe(3);
    expect(detail.exercises[0].target_reps_min).toBe(3);
    expect(detail.exercises[0].target_reps_max).toBe(10);
    expect(detail.exercises[1].exercise_id).toBe(squat.id);
    expect(detail.exercises[1].target_sets).toBe(2);
  });

  it('updateRoutineFromSession preserves skipped exercises with original targets', () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const squat = findExercise(db, 'Barbell Squat');
    const curl = findExercise(db, 'Barbell Curl');
    const routine = routineQueries.createRoutine(db, {
      name: 'Push A',
      exercises: buildRoutineInput(db, [
        { exercise: 'Barbell Bench Press', targetSets: 3, repsMin: 5, repsMax: 8 },
        { exercise: 'Barbell Squat', targetSets: 5, repsMin: 5, repsMax: 5 },
        { exercise: 'Barbell Curl', targetSets: 3, repsMin: 10, repsMax: 12 },
      ]),
    });
    const detail = routineQueries.getRoutineDetail(db, routine.id);
    const squatRe = detail.exercises.find((e) => e.exercise_id === squat.id);
    // Session: bench done (2 sets), squat pre-loaded but no sets completed, curl skipped entirely.
    const sessionId = logCompletedSession(db, [
      { exerciseId: bench.id, sets: [{ weight: 80, reps: 5 }, { weight: 85, reps: 5 }] },
    ]);
    // Add squat workout_exercise with origin link but no completed sets.
    db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id, sort_order, substituted_from_routine_exercise_id)
       VALUES (?, ?, 1, ?)`,
      [sessionId, squat.id, squatRe.id],
    );
    // curl has no workout_exercise at all.

    routineQueries.updateRoutineFromSession(db, routine.id, sessionId);
    const after = routineQueries.getRoutineDetail(db, routine.id);
    // All 3 exercises preserved.
    expect(after.exercises).toHaveLength(3);
    // Bench updated to today's actuals.
    const benchRow = after.exercises.find((e) => e.exercise_id === bench.id);
    expect(benchRow.target_sets).toBe(2);
    expect(benchRow.target_reps_min).toBe(5);
    expect(benchRow.target_reps_max).toBe(5);
    // Squat: pre-loaded but not performed → original targets kept.
    const squatRow = after.exercises.find((e) => e.exercise_id === squat.id);
    expect(squatRow.target_sets).toBe(5);
    expect(squatRow.target_reps_min).toBe(5);
    expect(squatRow.target_reps_max).toBe(5);
    // Curl: not in session at all → original targets kept.
    const curlRow = after.exercises.find((e) => e.exercise_id === curl.id);
    expect(curlRow.target_sets).toBe(3);
    expect(curlRow.target_reps_min).toBe(10);
    expect(curlRow.target_reps_max).toBe(12);
  });
});