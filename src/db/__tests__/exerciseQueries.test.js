import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises } from '../seed/seed.js';
import {
  getLookupOptions,
  searchExercises,
  getExerciseById,
  createCustomExercise,
  updateExercise,
  archiveExercise,
  unarchiveExercise,
  setPhotoPath,
  getExerciseHistory,
} from '../queries/exerciseQueries.js';

// ---- helpers --------------------------------------------------------------

// Log a session that uses `exerciseId` with the given sets. Bumps usage_count.
function logSession(db, exerciseId, sets, { startedAt } = {}) {
  let sessionId;
  let workoutExerciseId;
  db.transaction(() => {
    const s = db.execute(
      startedAt
        ? `INSERT INTO workout_session (started_at) VALUES (?) RETURNING id`
        : `INSERT INTO workout_session DEFAULT VALUES RETURNING id`,
      startedAt ? [startedAt] : [],
    );
    sessionId = s.rows[0].id;
    const we = db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id) VALUES (?, ?) RETURNING id`,
      [sessionId, exerciseId],
    );
    workoutExerciseId = we.rows[0].id;
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
  return { sessionId, workoutExerciseId };
}

function findByName(db, name) {
  return searchExercises(db, { query: name, includeArchived: true }).find(
    (e) => e.name.toLowerCase() === name.toLowerCase(),
  );
}

// ---- setup ----------------------------------------------------------------

let db;
beforeEach(() => {
  db = createInMemoryDb();
  seedExercises(db);
});
afterEach(() => db.close());

// ---- tests ----------------------------------------------------------------

describe('exerciseQueries — lookups', () => {
  it('returns muscle groups and equipment ordered alphabetically', () => {
    const { muscleGroups, equipment } = getLookupOptions(db);
    expect(muscleGroups.length).toBeGreaterThan(0);
    expect(equipment.length).toBeGreaterThan(0);
    const names = muscleGroups.map((m) => m.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

describe('exerciseQueries — search & sort', () => {
  it('returns exercises sorted by usage frequency (most-used first), ties by name', () => {
    const bench = findByName(db, 'Barbell Bench Press') ?? searchExercises(db)[0];
    const curl = findByName(db, 'Barbell Curl') ?? searchExercises(db)[1];
    // Use bench three times, curl once.
    logSession(db, bench.id, [{ weight: 100, reps: 5 }]);
    logSession(db, bench.id, [{ weight: 102.5, reps: 5 }]);
    logSession(db, bench.id, [{ weight: 105, reps: 5 }]);
    logSession(db, curl.id, [{ weight: 30, reps: 8 }]);

    const results = searchExercises(db);
    const benchRow = results.find((e) => e.id === bench.id);
    const curlRow = results.find((e) => e.id === curl.id);
    const neverUsedRow = results.find((e) => e.usage_count === 0);

    expect(benchRow.usage_count).toBe(3);
    expect(curlRow.usage_count).toBe(1);
    expect(neverUsedRow.usage_count).toBe(0);
    // Most-used ranks above less-used ranks above never-used.
    expect(results.indexOf(benchRow)).toBeLessThan(results.indexOf(curlRow));
    expect(results.indexOf(curlRow)).toBeLessThan(results.indexOf(neverUsedRow));
    // Never-used exercises are alphabetical among themselves.
    const zeroSlice = results.filter((e) => e.usage_count === 0);
    const zeroNames = zeroSlice.map((e) => e.name.toLowerCase());
    expect(zeroNames).toEqual([...zeroNames].sort());
  });

  it('searches by name (case-insensitive substring)', () => {
    const results = searchExercises(db, { query: 'curl' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.name.toLowerCase().includes('curl'))).toBe(true);
  });

  it('filters by muscle group (matches primary OR secondary)', () => {
    const biceps = getLookupOptions(db).muscleGroups.find((m) => m.name === 'biceps');
    const results = searchExercises(db, { muscleGroupId: biceps.id });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (e) => e.primary_muscle_group_id === biceps.id || e.secondary_muscle_group_id === biceps.id,
      ),
    ).toBe(true);
  });

  it('filters by equipment', () => {
    const barbell = getLookupOptions(db).equipment.find((e) => e.name === 'barbell');
    const results = searchExercises(db, { equipmentId: barbell.id });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.equipment_id === barbell.id)).toBe(true);
  });

  it('combines name + muscle + equipment filters', () => {
    const barbell = getLookupOptions(db).equipment.find((e) => e.name === 'barbell');
    const triceps = getLookupOptions(db).muscleGroups.find((m) => m.name === 'triceps');
    const results = searchExercises(db, {
      query: 'press',
      muscleGroupId: triceps.id,
      equipmentId: barbell.id,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (e) =>
          e.name.toLowerCase().includes('press') &&
          e.equipment_id === barbell.id &&
          (e.primary_muscle_group_id === triceps.id || e.secondary_muscle_group_id === triceps.id),
      ),
    ).toBe(true);
  });

  it('resolves muscle/equipment names in returned rows', () => {
    const curl = findByName(db, 'Barbell Curl');
    expect(curl.primary_muscle).toBe('biceps');
    expect(curl.secondary_muscle).toBe('forearms');
    expect(curl.equipment).toBe('barbell');
    expect(curl.usage_count).toBe(0);
    expect(curl.last_performed_at).toBeNull();
  });

  it('excludes archived exercises by default, includes them when asked', () => {
    const curl = findByName(db, 'Barbell Curl');
    archiveExercise(db, curl.id);
    // The archived exercise is gone from default search...
    const visible = searchExercises(db, { query: 'curl' });
    expect(visible.find((e) => e.id === curl.id)).toBeUndefined();
    // ...but reappears with includeArchived, flagged.
    const archived = searchExercises(db, { query: 'curl', includeArchived: true });
    const archivedCurl = archived.find((e) => e.id === curl.id);
    expect(archivedCurl).toBeDefined();
    expect(archivedCurl.is_archived).toBe(1);
  });
});

describe('exerciseQueries — getExerciseById', () => {
  it('returns the resolved row for an id', () => {
    const curl = findByName(db, 'Barbell Curl');
    const byId = getExerciseById(db, curl.id);
    expect(byId.id).toBe(curl.id);
    expect(byId.name).toBe('Barbell Curl');
    expect(byId.is_custom).toBe(0);
  });

  it('returns null for a missing id', () => {
    expect(getExerciseById(db, 99999999)).toBeNull();
  });
});

describe('exerciseQueries — create custom exercise', () => {
  it('creates a custom exercise with is_custom=1 and resolves names', () => {
    const { muscleGroups, equipment } = getLookupOptions(db);
    const biceps = muscleGroups.find((m) => m.name === 'biceps');
    const forearms = muscleGroups.find((m) => m.name === 'forearms');
    const dumbbell = equipment.find((e) => e.name === 'dumbbell');

    const created = createCustomExercise(db, {
      name: 'My Custom Hammer Curl',
      primary_muscle_group_id: biceps.id,
      secondary_muscle_group_id: forearms.id,
      equipment_id: dumbbell.id,
      default_increment: 2.5,
      default_rep_range_min: 8,
      default_rep_range_max: 12,
      default_rest_seconds: 60,
      default_notes: 'Keep elbows pinned.',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.is_custom).toBe(1);
    expect(created.is_archived).toBe(0);
    expect(created.primary_muscle).toBe('biceps');
    expect(created.secondary_muscle).toBe('forearms');
    expect(created.equipment).toBe('dumbbell');
    expect(created.default_increment).toBe(2.5);
    expect(created.default_rep_range_min).toBe(8);
    expect(created.default_rep_range_max).toBe(12);
    expect(created.default_rest_seconds).toBe(60);
    expect(created.default_notes).toBe('Keep elbows pinned.');
  });

  it('custom exercises appear identically to built-in in search results', () => {
    createCustomExercise(db, { name: 'Cable Wood Chopper' });
    const results = searchExercises(db, { query: 'chopper' });
    expect(results).toHaveLength(1);
    // Same shape as a built-in row; is_custom is the only differentiator.
    const builtIn = searchExercises(db, { query: 'Barbell Curl' })[0];
    expect(Object.keys(results[0]).sort()).toEqual(Object.keys(builtIn).sort());
    expect(results[0].is_custom).toBe(1);
    expect(builtIn.is_custom).toBe(0);
  });

  it('applies schema defaults for omitted numeric fields', () => {
    const created = createCustomExercise(db, { name: 'Bare Custom Move' });
    expect(created.default_increment).toBe(2.5);
    expect(created.default_rep_range_min).toBe(5);
    expect(created.default_rep_range_max).toBe(12);
    expect(created.default_rest_seconds).toBe(90);
    expect(created.exercise_type).toBe('strength');
  });

  it('rejects an empty name', () => {
    expect(() => createCustomExercise(db, { name: '   ' })).toThrow(/name/i);
    expect(() => createCustomExercise(db, { name: '' })).toThrow(/name/i);
  });

  it('rejects a duplicate name', () => {
    createCustomExercise(db, { name: 'Unique Custom Move' });
    expect(() => createCustomExercise(db, { name: 'Unique Custom Move' })).toThrow();
  });

  it('rejects invalid enum values', () => {
    expect(() =>
      createCustomExercise(db, { name: 'Bad Type', exercise_type: 'hypertrophy' }),
    ).toThrow(/exercise_type/i);
    expect(() =>
      createCustomExercise(db, { name: 'Bad Force', force: 'twist' }),
    ).toThrow(/force/i);
  });

  it('rejects rep range min > max', () => {
    expect(() =>
      createCustomExercise(db, {
        name: 'Bad Reps',
        default_rep_range_min: 12,
        default_rep_range_max: 5,
      }),
    ).toThrow(/rep_range_min/);
  });
});

describe('exerciseQueries — update', () => {
  it('updates only the supplied fields and bumps updated_at', () => {
    const curl = findByName(db, 'Barbell Curl');
    const before = getExerciseById(db, curl.id);
    const updated = updateExercise(db, curl.id, {
      default_increment: 5,
      default_rest_seconds: 120,
      default_notes: 'New cue.',
    });
    expect(updated.default_increment).toBe(5);
    expect(updated.default_rest_seconds).toBe(120);
    expect(updated.default_notes).toBe('New cue.');
    // Untouched fields preserved.
    expect(updated.default_rep_range_min).toBe(before.default_rep_range_min);
    expect(updated.name).toBe('Barbell Curl');
    expect(updated.updated_at).not.toBe(before.updated_at);
  });

  it('can rename a built-in exercise', () => {
    const curl = findByName(db, 'Barbell Curl');
    const renamed = updateExercise(db, curl.id, { name: 'Barbell Bicep Curl' });
    expect(renamed.name).toBe('Barbell Bicep Curl');
    expect(getExerciseById(db, curl.id).name).toBe('Barbell Bicep Curl');
  });

  it('rejects renaming to an existing name', () => {
    const curl = findByName(db, 'Barbell Curl');
    const bench = findByName(db, 'Barbell Bench Press');
    expect(() => updateExercise(db, curl.id, { name: bench.name })).toThrow();
  });

  it('is a no-op (returns current row) when patch is empty', () => {
    const curl = findByName(db, 'Barbell Curl');
    const row = updateExercise(db, curl.id, {});
    expect(row.id).toBe(curl.id);
    expect(row.name).toBe('Barbell Curl');
  });
});

describe('exerciseQueries — archive / photo', () => {
  it('archive soft-deletes (is_archived=1) and preserves historical data', () => {
    const curl = findByName(db, 'Barbell Curl');
    logSession(db, curl.id, [{ weight: 30, reps: 8 }]);

    const archived = archiveExercise(db, curl.id);
    expect(archived.is_archived).toBe(1);
    // Hidden from default search.
    const visible = searchExercises(db, { query: 'curl' });
    expect(visible.find((e) => e.id === curl.id)).toBeUndefined();
    // History intact.
    const history = getExerciseHistory(db, curl.id);
    expect(history).toHaveLength(1);
    expect(history[0].sets).toHaveLength(1);
    expect(history[0].sets[0].weight).toBe(30);
  });

  it('unarchive restores visibility', () => {
    const curl = findByName(db, 'Barbell Curl');
    archiveExercise(db, curl.id);
    const restored = unarchiveExercise(db, curl.id);
    expect(restored.is_archived).toBe(0);
    const visible = searchExercises(db, { query: 'curl' });
    expect(visible.find((e) => e.id === curl.id)).toBeDefined();
  });

  it('setPhotoPath attaches and clears a photo for any exercise', () => {
    const curl = findByName(db, 'Barbell Curl');
    const withPhoto = setPhotoPath(db, curl.id, 'file:///photos/curl.jpg');
    expect(withPhoto.photo_path).toBe('file:///photos/curl.jpg');
    const cleared = setPhotoPath(db, curl.id, null);
    expect(cleared.photo_path).toBeNull();
  });
});

describe('exerciseQueries — getExerciseHistory', () => {
  it('returns sessions newest-first with nested sets in order', () => {
    const curl = findByName(db, 'Barbell Curl');
    logSession(db, curl.id, [{ weight: 30, reps: 10 }, { weight: 32.5, reps: 8 }], {
      startedAt: '2026-01-01T10:00:00.000Z',
    });
    logSession(db, curl.id, [{ weight: 35, reps: 5 }], {
      startedAt: '2026-02-01T10:00:00.000Z',
    });

    const history = getExerciseHistory(db, curl.id);
    expect(history).toHaveLength(2);
    // Newest first.
    expect(history[0].started_at).toBe('2026-02-01T10:00:00.000Z');
    expect(history[0].sets).toHaveLength(1);
    expect(history[0].sets[0].weight).toBe(35);
    expect(history[1].sets).toHaveLength(2);
    // Sets preserve sort_order.
    expect(history[1].sets[0].sort_order).toBe(0);
    expect(history[1].sets[1].sort_order).toBe(1);
    expect(history[1].sets[1].weight).toBe(32.5);
  });

  it('returns an empty array for an exercise with no history', () => {
    const curl = findByName(db, 'Barbell Curl');
    expect(getExerciseHistory(db, curl.id)).toEqual([]);
  });
});