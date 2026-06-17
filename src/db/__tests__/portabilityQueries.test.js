import { describe, it, expect, beforeEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises } from '../seed/seed.js';
import {
  exportToJson,
  importFromJson,
  exportHistoryToCsv,
  BACKUP_FORMAT_VERSION,
} from '../queries/portabilityQueries.js';

// Minimal, internally-consistent sample data spanning every exported table and
// every foreign-key chain (exercise -> lookups, session -> workout_exercise ->
// exercise_set, superset, pair frequency, routine, measurement). Inserted in
// dependency order so FK-on inserts succeed on a migrated in-memory DB.
function seedSampleData(db) {
  db.execute(`INSERT INTO muscle_group (id, name) VALUES (1, 'chest')`);
  db.execute(`INSERT INTO equipment (id, name) VALUES (1, 'barbell')`);
  db.execute(`INSERT INTO exercise (id, name, primary_muscle_group_id, equipment_id) VALUES (1, 'Bench Press', 1, 1)`);
  db.execute(`INSERT INTO exercise (id, name, primary_muscle_group_id, equipment_id) VALUES (2, 'Dip', 1, 1)`);
  db.execute(`INSERT INTO routine_folder (id, name) VALUES (1, 'PPL')`);
  db.execute(`INSERT INTO routine (id, folder_id, name) VALUES (1, 1, 'Push A')`);
  db.execute(`INSERT INTO routine_exercise (id, routine_id, exercise_id) VALUES (1, 1, 1)`);
  db.execute(`INSERT INTO workout_session (id, started_at, routine_id, is_completed) VALUES (1, '2026-06-17T10:00:00.000Z', 1, 1)`);
  db.execute(`INSERT INTO workout_exercise (id, session_id, exercise_id, sort_order) VALUES (1, 1, 1, 0)`);
  db.execute(`INSERT INTO workout_exercise (id, session_id, exercise_id, sort_order) VALUES (2, 1, 2, 1)`);
  db.execute(`INSERT INTO exercise_set (id, workout_exercise_id, sort_order, weight, reps, set_type, is_completed) VALUES (1, 1, 0, 100, 5, 'normal', 1)`);
  db.execute(`INSERT INTO exercise_set (id, workout_exercise_id, sort_order, weight, reps, set_type, is_completed) VALUES (2, 2, 0, 50, 8, 'normal', 1)`);
  db.execute(`INSERT INTO superset_group (id, session_id) VALUES (1, 1)`);
  db.execute(`INSERT INTO superset_member (id, superset_group_id, workout_exercise_id, sort_order) VALUES (1, 1, 1, 0)`);
  db.execute(`INSERT INTO superset_member (id, superset_group_id, workout_exercise_id, sort_order) VALUES (2, 1, 2, 1)`);
  db.execute(`INSERT INTO exercise_pair_frequency (id, exercise_a_id, exercise_b_id, count) VALUES (1, 1, 2, 1)`);
  db.execute(`INSERT INTO body_measurement (id, date, weight, body_fat_pct, notes) VALUES (1, '2026-06-17', 80, 15, 'morning')`);
}

function count(db, table) {
  return db.execute(`SELECT COUNT(*) AS c FROM ${table}`).rows[0].c;
}

// Sort each table's rows by id so array comparison is order-independent.
function sortedTables(tables) {
  const out = {};
  for (const [name, rows] of Object.entries(tables)) {
    out[name] = [...rows].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }
  return out;
}

describe('JSON export/import', () => {
  let db;
  let json;
  let tables;

  beforeEach(() => {
    db = createInMemoryDb();
    seedSampleData(db);
    json = exportToJson(db);
    tables = sortedTables(JSON.parse(json).tables);
  });

  it('produces a versioned envelope with every user-data table', () => {
    const payload = JSON.parse(json);
    expect(payload.version).toBe(BACKUP_FORMAT_VERSION);
    expect(payload.schemaVersion).toBeGreaterThan(0);
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(payload.tables).sort()).toEqual(
      [
        'body_measurement',
        'equipment',
        'exercise',
        'exercise_pair_frequency',
        'exercise_set',
        'muscle_group',
        'routine',
        'routine_exercise',
        'routine_folder',
        'superset_group',
        'superset_member',
        'workout_exercise',
        'workout_session',
      ],
    );
  });

  it('round-trips: import into a fresh DB reproduces every table exactly', () => {
    const fresh = createInMemoryDb();
    const summary = importFromJson(fresh, json);
    expect(summary.tables.length).toBe(13);

    const restored = sortedTables(JSON.parse(exportToJson(fresh)).tables);
    expect(restored).toEqual(tables);
  });

  it('replaces existing data on import (restore over a seeded device)', () => {
    const seeded = createInMemoryDb();
    seedExercises(seeded);
    expect(count(seeded, 'exercise')).toBeGreaterThan(2);

    importFromJson(seeded, json);

    // The seed's exercises are gone; only the backup's two remain, with the
    // backup's exact ids/rows.
    expect(count(seeded, 'exercise')).toBe(2);
    expect(sortedTables(JSON.parse(exportToJson(seeded)).tables)).toEqual(tables);
  });

  it('preserves foreign-key relationships after import', () => {
    const fresh = createInMemoryDb();
    importFromJson(fresh, json);
    const { rows } = fresh.execute(
      `SELECT es.weight, es.reps, e.name
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
       JOIN exercise e ON e.id = we.exercise_id
       ORDER BY es.id`,
    );
    expect(rows).toEqual([
      { weight: 100, reps: 5, name: 'Bench Press' },
      { weight: 50, reps: 8, name: 'Dip' },
    ]);
  });

  it('rejects non-JSON input with a descriptive error', () => {
    const fresh = createInMemoryDb();
    expect(() => importFromJson(fresh, 'not json {')).toThrow(/Invalid JSON file/);
  });

  it('rejects a JSON object without a tables object', () => {
    const fresh = createInMemoryDb();
    expect(() => importFromJson(fresh, '{"foo": 1}')).toThrow(/missing "tables"/);
    expect(() => importFromJson(fresh, '{"tables": []}')).toThrow(/missing "tables"/);
  });

  it('rejects a table that is not an array of rows', () => {
    const fresh = createInMemoryDb();
    expect(() => importFromJson(fresh, '{"tables": {"exercise": "oops"}}')).toThrow(
      /"exercise" must be an array/,
    );
  });

  it('rejects rows with invalid column names (injection guard)', () => {
    const fresh = createInMemoryDb();
    const dump = JSON.stringify({ tables: { exercise: [{ id: 1, 'bad col!': 1 }] } });
    expect(() => importFromJson(fresh, dump)).toThrow(/invalid column/);
  });

  it('leaves the database unchanged when import fails mid-way', () => {
    const fresh = createInMemoryDb();
    seedSampleData(fresh);
    const before = count(fresh, 'exercise');
    // A dump referencing a missing parent (set without its workout_exercise)
    // violates FK and must roll back the whole transaction.
    const dump = JSON.stringify({
      tables: {
        exercise_set: [{ id: 99, workout_exercise_id: 999, sort_order: 0, weight: 10, reps: 3 }],
      },
    });
    expect(() => importFromJson(fresh, dump)).toThrow();
    expect(count(fresh, 'exercise')).toBe(before);
    expect(count(fresh, 'exercise_set')).toBe(2);
  });
});

describe('CSV history export', () => {
  it('emits a header plus one row per set, joined to session + exercise', () => {
    const db = createInMemoryDb();
    seedSampleData(db);
    const csv = exportHistoryToCsv(db);
    const expected = [
      'date,exercise,set,weight,reps',
      '2026-06-17,Bench Press,1,100,5',
      '2026-06-17,Dip,1,50,8',
    ].join('\r\n');
    expect(csv).toBe(expected);
  });

  it('produces only the header when there is no history', () => {
    const db = createInMemoryDb();
    expect(exportHistoryToCsv(db)).toBe('date,exercise,set,weight,reps');
  });

  it('quotes fields containing commas or quotes', () => {
    const db = createInMemoryDb();
    db.execute(`INSERT INTO muscle_group (id, name) VALUES (1, 'chest')`);
    db.execute(`INSERT INTO exercise (id, name) VALUES (1, 'Chest, Press "A"')`);
    db.execute(`INSERT INTO workout_session (id, started_at) VALUES (1, '2026-06-17T10:00:00.000Z')`);
    db.execute(`INSERT INTO workout_exercise (id, session_id, exercise_id, sort_order) VALUES (1, 1, 1, 0)`);
    db.execute(`INSERT INTO exercise_set (id, workout_exercise_id, sort_order, weight, reps) VALUES (1, 1, 0, 80, 10)`);
    const csv = exportHistoryToCsv(db);
    expect(csv).toContain('"Chest, Press ""A"""');
  });
});