import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { initDatabase, resetDatabaseForTesting, getDatabase } from '../../utils/db.js';
import { seedExercises } from '../../db/seed/seed.js';
import { useExerciseStore } from '../exerciseStore.js';

// ---- helpers --------------------------------------------------------------

function logSession(exerciseId, sets, { startedAt } = {}) {
  const db = getDatabase();
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
  });
}

const INITIAL_STATE = {
  exercises: [],
  isLoading: false,
  searchQuery: '',
  filters: { muscleGroupId: null, equipmentId: null, exerciseType: null },
  lookups: { muscleGroups: [], equipment: [] },
  currentExercise: null,
  currentHistory: [],
  error: null,
};

function resetStore() {
  useExerciseStore.setState({ ...INITIAL_STATE, filters: { ...INITIAL_STATE.filters }, lookups: { ...INITIAL_STATE.lookups } });
}

beforeEach(() => {
  resetDatabaseForTesting();
  const db = initDatabase({ name: ':memory:' });
  seedExercises(db);
  resetStore();
});
afterEach(() => {
  resetDatabaseForTesting();
});

// ---- tests ----------------------------------------------------------------

describe('exerciseStore — loadLibrary & search', () => {
  it('loadLibrary populates exercises (frequency-sorted) and lookups', async () => {
    const exercises = await useExerciseStore.getState().loadLibrary();
    expect(exercises.length).toBeGreaterThan(0);
    const state = useExerciseStore.getState();
    expect(state.exercises).toBe(exercises);
    expect(state.lookups.muscleGroups.length).toBeGreaterThan(0);
    expect(state.lookups.equipment.length).toBeGreaterThan(0);
    expect(state.isLoading).toBe(false);
  });

  it('search filters by name and stores the query', async () => {
    await useExerciseStore.getState().loadLibrary();
    const results = await useExerciseStore.getState().search('curl');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.name.toLowerCase().includes('curl'))).toBe(true);
    expect(useExerciseStore.getState().searchQuery).toBe('curl');
  });

  it('setFilters narrows by muscle group; clearFilters resets', async () => {
    await useExerciseStore.getState().loadLibrary();
    const biceps = useExerciseStore.getState().lookups.muscleGroups.find((m) => m.name === 'biceps');
    await useExerciseStore.getState().setFilters({ muscleGroupId: biceps.id });
    const filtered = useExerciseStore.getState().exercises;
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (e) => e.primary_muscle_group_id === biceps.id || e.secondary_muscle_group_id === biceps.id,
      ),
    ).toBe(true);

    await useExerciseStore.getState().clearFilters();
    const cleared = useExerciseStore.getState().exercises;
    expect(useExerciseStore.getState().filters.muscleGroupId).toBeNull();
    expect(cleared.length).toBeGreaterThan(filtered.length);
  });

  it('lists exercises sorted by usage frequency (most-used first)', async () => {
    const all = await useExerciseStore.getState().loadLibrary();
    const bench = all.find((e) => e.name === 'Barbell Bench Press') ?? all[0];
    const curl = all.find((e) => e.name === 'Barbell Curl') ?? all[1];
    logSession(bench.id, [{ weight: 100, reps: 5 }]);
    logSession(bench.id, [{ weight: 102.5, reps: 5 }]);
    logSession(curl.id, [{ weight: 30, reps: 8 }]);

    const sorted = await useExerciseStore.getState().loadLibrary();
    const benchRow = sorted.find((e) => e.id === bench.id);
    const curlRow = sorted.find((e) => e.id === curl.id);
    expect(benchRow.usage_count).toBe(2);
    expect(curlRow.usage_count).toBe(1);
    expect(sorted.indexOf(benchRow)).toBeLessThan(sorted.indexOf(curlRow));
  });
});

describe('exerciseStore — create / edit / archive / photo', () => {
  it('createCustomExercise inserts is_custom=1, appears in the cached list', async () => {
    await useExerciseStore.getState().loadLibrary();
    const created = await useExerciseStore.getState().createCustomExercise({
      name: 'Plate-Loaded Hammer Curl',
      default_rest_seconds: 45,
    });
    expect(created.is_custom).toBe(1);

    const state = useExerciseStore.getState();
    const inList = state.exercises.find((e) => e.id === created.id);
    expect(inList).toBeDefined();
    expect(inList.name).toBe('Plate-Loaded Hammer Curl');
  });

  it('custom exercises appear identically to built-in in cached search results', async () => {
    await useExerciseStore.getState().loadLibrary();
    await useExerciseStore.getState().createCustomExercise({ name: 'Cable Wood Chopper' });
    await useExerciseStore.getState().search('chopper');
    const results = useExerciseStore.getState().exercises;
    expect(results).toHaveLength(1);
    expect(results[0].is_custom).toBe(1);
    // Same keys as a built-in row.
    await useExerciseStore.getState().search('Barbell Curl');
    const builtIn = useExerciseStore.getState().exercises[0];
    expect(Object.keys(results[0]).sort()).toEqual(Object.keys(builtIn).sort());
  });

  it('updateExerciseMetadata writes fields, refreshes list + currentExercise', async () => {
    await useExerciseStore.getState().loadLibrary();
    const curl = useExerciseStore.getState().exercises.find((e) => e.name === 'Barbell Curl');
    await useExerciseStore.getState().loadExercise(curl.id);
    expect(useExerciseStore.getState().currentExercise.id).toBe(curl.id);

    const updated = await useExerciseStore.getState().updateExerciseMetadata(curl.id, {
      default_increment: 5,
      default_notes: 'Cue updated.',
    });
    expect(updated.default_increment).toBe(5);
    expect(updated.default_notes).toBe('Cue updated.');
    // currentExercise refreshed.
    expect(useExerciseStore.getState().currentExercise.default_increment).toBe(5);
    // List refreshed with the change.
    const inList = useExerciseStore.getState().exercises.find((e) => e.id === curl.id);
    expect(inList.default_increment).toBe(5);
  });

  it('archiveExercise removes from cached list but preserves history', async () => {
    await useExerciseStore.getState().loadLibrary();
    const curl = useExerciseStore.getState().exercises.find((e) => e.name === 'Barbell Curl');
    logSession(curl.id, [{ weight: 30, reps: 8 }]);

    const archived = await useExerciseStore.getState().archiveExercise(curl.id);
    expect(archived.is_archived).toBe(1);
    // Gone from the default cached list.
    expect(useExerciseStore.getState().exercises.find((e) => e.id === curl.id)).toBeUndefined();
    // History still loadable.
    const history = await useExerciseStore.getState().loadHistory(curl.id);
    expect(history).toHaveLength(1);
    expect(history[0].sets[0].weight).toBe(30);
  });

  it('setPhotoPath attaches and refreshes currentExercise', async () => {
    await useExerciseStore.getState().loadLibrary();
    const curl = useExerciseStore.getState().exercises.find((e) => e.name === 'Barbell Curl');
    await useExerciseStore.getState().loadExercise(curl.id);
    const updated = await useExerciseStore.getState().setPhotoPath(curl.id, 'file:///photos/curl.jpg');
    expect(updated.photo_path).toBe('file:///photos/curl.jpg');
    expect(useExerciseStore.getState().currentExercise.photo_path).toBe('file:///photos/curl.jpg');
  });

  it('rejects a duplicate custom exercise name', async () => {
    await useExerciseStore.getState().loadLibrary();
    await useExerciseStore.getState().createCustomExercise({ name: 'One-Off Move' });
    await expect(
      useExerciseStore.getState().createCustomExercise({ name: 'One-Off Move' }),
    ).rejects.toThrow();
  });

  it('rejects an empty custom exercise name', async () => {
    await useExerciseStore.getState().loadLibrary();
    await expect(
      useExerciseStore.getState().createCustomExercise({ name: '   ' }),
    ).rejects.toThrow(/name/i);
  });
});

describe('exerciseStore — history', () => {
  it('loadHistory returns sessions newest-first with nested sets', async () => {
    await useExerciseStore.getState().loadLibrary();
    const curl = useExerciseStore.getState().exercises.find((e) => e.name === 'Barbell Curl');
    logSession(curl.id, [{ weight: 30, reps: 10 }, { weight: 32.5, reps: 8 }], {
      startedAt: '2026-01-01T10:00:00.000Z',
    });
    logSession(curl.id, [{ weight: 35, reps: 5 }], { startedAt: '2026-02-01T10:00:00.000Z' });

    const history = await useExerciseStore.getState().loadHistory(curl.id);
    expect(history).toHaveLength(2);
    expect(history[0].started_at).toBe('2026-02-01T10:00:00.000Z');
    expect(history[0].sets).toHaveLength(1);
    expect(history[1].sets).toHaveLength(2);
  });
});