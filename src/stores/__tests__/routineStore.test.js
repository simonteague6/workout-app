import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { initDatabase, resetDatabaseForTesting } from '../../utils/db.js';
import { seedExercises } from '../../db/seed/seed.js';
import { useRoutineStore } from '../routineStore.js';
import { searchExercises } from '../../db/queries/exerciseQueries.js';

// ---- helpers --------------------------------------------------------------

function findExercise(db, name) {
  const results = searchExercises(db, { query: name, includeArchived: true });
  return results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

const INITIAL_STATE = {
  folders: [],
  routines: [],
  currentRoutine: null,
  currentPreview: null,
  isLoading: false,
  error: null,
};

function resetStore() {
  useRoutineStore.setState({ ...INITIAL_STATE });
}

let db;
beforeEach(() => {
  resetDatabaseForTesting();
  db = initDatabase({ name: ':memory:' });
  seedExercises(db);
  resetStore();
});
afterEach(() => {
  resetDatabaseForTesting();
});

// ---- tests ----------------------------------------------------------------

describe('routineStore — folders', () => {
  it('createFolder adds a folder and refreshes `folders`', async () => {
    const folder = await useRoutineStore.getState().createFolder('Push Pull Legs');
    expect(folder.name).toBe('Push Pull Legs');
    expect(useRoutineStore.getState().folders.map((f) => f.name)).toContain('Push Pull Legs');
  });

  it('loadFolders loads all folders ordered', async () => {
    await useRoutineStore.getState().createFolder('A');
    await useRoutineStore.getState().createFolder('B');
    resetStore();
    await useRoutineStore.getState().loadFolders();
    expect(useRoutineStore.getState().folders).toHaveLength(2);
  });
});

describe('routineStore — createRoutine', () => {
  it('creates a routine + routine_exercise rows with correct sort_order and refreshes `routines`', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const squat = findExercise(db, 'Barbell Squat');
    const folder = await useRoutineStore.getState().createFolder('PPL');
    const routine = await useRoutineStore.getState().createRoutine({
      name: 'Push A',
      folderId: folder.id,
      exercises: [
        { exerciseId: bench.id, targetSets: 4, targetRepsMin: 5, targetRepsMax: 8, targetRestSeconds: 180 },
        { exerciseId: squat.id, targetSets: 3 },
      ],
    });
    expect(routine.id).toBeGreaterThan(0);
    expect(routine.folder_id).toBe(folder.id);

    const detail = await useRoutineStore.getState().loadRoutineDetail(routine.id);
    expect(detail.exercises).toHaveLength(2);
    expect(detail.exercises[0].exercise_id).toBe(bench.id);
    expect(detail.exercises[0].sort_order).toBe(0);
    expect(detail.exercises[0].target_sets).toBe(4);
    expect(detail.exercises[1].sort_order).toBe(1);

    // `routines` cache refreshed with exercise_count.
    const cached = useRoutineStore.getState().routines.find((r) => r.id === routine.id);
    expect(cached.exercise_count).toBe(2);
    expect(cached.folder_name).toBe('PPL');
  });
});

describe('routineStore — editRoutine (targets + reorder)', () => {
  it('editRoutine updates target sets/reps/rest and reorders via the exercises list', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const squat = findExercise(db, 'Barbell Squat');
    const routine = await useRoutineStore.getState().createRoutine({
      name: 'R',
      exercises: [
        { exerciseId: bench.id, targetSets: 3 },
        { exerciseId: squat.id, targetSets: 3 },
      ],
    });
    // Reorder: squat first with new targets, bench second.
    const updated = await useRoutineStore.getState().editRoutine(routine.id, {
      exercises: [
        { exerciseId: squat.id, targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRestSeconds: 120 },
        { exerciseId: bench.id, targetSets: 4 },
      ],
    });
    expect(updated.exercises[0].exercise_id).toBe(squat.id);
    expect(updated.exercises[0].target_sets).toBe(5);
    expect(updated.exercises[1].exercise_id).toBe(bench.id);
    expect(useRoutineStore.getState().currentRoutine.exercises[0].exercise_id).toBe(squat.id);
  });

  it('editRoutine renames and moves the folder', async () => {
    const f1 = await useRoutineStore.getState().createFolder('A');
    const f2 = await useRoutineStore.getState().createFolder('B');
    const routine = await useRoutineStore.getState().createRoutine({
      name: 'R',
      folderId: f1.id,
      exercises: [],
    });
    const updated = await useRoutineStore.getState().editRoutine(routine.id, {
      name: 'Renamed',
      folderId: f2.id,
    });
    expect(updated.name).toBe('Renamed');
    expect(updated.folder_id).toBe(f2.id);
  });
});

describe('routineStore — moveRoutineToFolder + deleteRoutine', () => {
  it('moves a routine between folders (and to unfiled via null)', async () => {
    const f1 = await useRoutineStore.getState().createFolder('A');
    const f2 = await useRoutineStore.getState().createFolder('B');
    const routine = await useRoutineStore.getState().createRoutine({
      name: 'R',
      folderId: f1.id,
      exercises: [],
    });
    await useRoutineStore.getState().moveRoutineToFolder(routine.id, f2.id);
    expect(useRoutineStore.getState().routines.find((r) => r.id === routine.id).folder_name).toBe('B');
    await useRoutineStore.getState().moveRoutineToFolder(routine.id, null);
    expect(useRoutineStore.getState().routines.find((r) => r.id === routine.id).folder_name).toBeNull();
  });

  it('deleteRoutine removes the routine and refreshes `routines`', async () => {
    const routine = await useRoutineStore.getState().createRoutine({ name: 'R', exercises: [] });
    await useRoutineStore.getState().deleteRoutine(routine.id);
    expect(useRoutineStore.getState().routines.find((r) => r.id === routine.id)).toBeUndefined();
    expect(useRoutineStore.getState().currentRoutine).toBeNull();
  });
});

describe('routineStore — preview + saveAsNewFromDiff', () => {
  it('loadRoutinePreview sets currentPreview with lastSession per exercise', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    // Seed a prior completed session for bench.
    db.transaction(() => {
      const s = db.execute(`INSERT INTO workout_session (started_at) VALUES (?) RETURNING id`, [
        '2025-03-01T00:00:00.000Z',
      ]);
      const we = db.execute(
        `INSERT INTO workout_exercise (session_id, exercise_id) VALUES (?, ?) RETURNING id`,
        [s.rows[0].id, bench.id],
      );
      db.executeBatch([
        {
          sql: `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps, is_completed) VALUES (?, ?, ?, ?, 1)`,
          params: [we.rows[0].id, 0, 80, 8],
        },
      ]);
      db.execute(`UPDATE workout_session SET finished_at = ?, is_completed = 1 WHERE id = ?`, [
        '2025-03-01T00:30:00.000Z',
        s.rows[0].id,
      ]);
    });
    const routine = await useRoutineStore.getState().createRoutine({
      name: 'R',
      exercises: [{ exerciseId: bench.id, targetSets: 3 }],
    });
    const preview = await useRoutineStore.getState().loadRoutinePreview(routine.id);
    expect(preview.exercises[0].lastSession).not.toBeNull();
    expect(preview.exercises[0].lastSession.sets[0].weight).toBe(80);
    expect(useRoutineStore.getState().currentPreview).toBe(preview);
  });

  it('saveAsNewFromDiff creates a new routine from a finished session', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    const folder = await useRoutineStore.getState().createFolder('PPL');
    // Build a completed session directly in the DB.
    let sessionId;
    db.transaction(() => {
      const s = db.execute(`INSERT INTO workout_session DEFAULT VALUES RETURNING id`);
      sessionId = s.rows[0].id;
      const we = db.execute(
        `INSERT INTO workout_exercise (session_id, exercise_id) VALUES (?, ?) RETURNING id`,
        [sessionId, bench.id],
      );
      db.executeBatch([
        {
          sql: `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps, is_completed) VALUES (?, ?, ?, ?, 1)`,
          params: [we.rows[0].id, 0, 90, 5],
        },
        {
          sql: `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps, is_completed) VALUES (?, ?, ?, ?, 1)`,
          params: [we.rows[0].id, 1, 90, 5],
        },
      ]);
      db.execute(`UPDATE workout_session SET finished_at = ?, is_completed = 1 WHERE id = ?`, [
        '2025-04-01T00:30:00.000Z',
        sessionId,
      ]);
    });
    const routine = await useRoutineStore.getState().saveAsNewFromDiff(sessionId, 'Copied', folder.id);
    expect(routine.name).toBe('Copied');
    expect(routine.folder_id).toBe(folder.id);
    const cached = useRoutineStore.getState().routines.find((r) => r.id === routine.id);
    expect(cached.exercise_count).toBe(1);
  });
});