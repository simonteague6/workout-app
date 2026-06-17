import { describe, it, expect } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import {
  createInMemoryDb,
  runMigrations,
  getCurrentVersion,
  splitStatements,
  LATEST_SCHEMA_VERSION,
} from '../../utils/db.js';
import { migrations } from '../../db/migrations/index.js';

const EXPECTED_TABLES = [
  'muscle_group',
  'equipment',
  'exercise',
  'routine_folder',
  'routine',
  'routine_exercise',
  'workout_session',
  'workout_exercise',
  'exercise_set',
  'superset_group',
  'superset_member',
  'exercise_pair_frequency',
  'body_measurement',
  'app_settings',
  'schema_migrations',
];

function tableNames(db) {
  // Use the adapter's execute for the migrated DB, raw sqlite for the schema.sql DB.
  const { rows } = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

describe('migration runner', () => {
  it('applies the initial migration and creates every required table', () => {
    const db = createInMemoryDb();
    const tables = tableNames(db);
    for (const t of EXPECTED_TABLES) {
      expect(tables).toContain(t);
    }
    db.close();
  });

  it('records the applied migration version in schema_migrations', () => {
    const db = createInMemoryDb();
    expect(getCurrentVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    const { rows } = db.execute('SELECT version, name FROM schema_migrations');
    expect(rows).toHaveLength(migrations.length);
    expect(rows[0].version).toBe(1);
    expect(rows[0].name).toBe('initial_schema');
    expect(rows[rows.length - 1].version).toBe(LATEST_SCHEMA_VERSION);
  });

  it('is idempotent — re-running with no new migrations is a no-op', () => {
    const db = createInMemoryDb();
    const before = getCurrentVersion(db);
    const result = runMigrations(db);
    expect(result).toBe(before);
    expect(getCurrentVersion(db)).toBe(before);
    // re-running with no new migrations leaves the row count unchanged
    const { rows } = db.execute('SELECT COUNT(*) AS c FROM schema_migrations');
    expect(rows[0].c).toBe(migrations.length);
    db.close();
  });

  it('enables foreign keys', () => {
    const db = createInMemoryDb();
    const { rows } = db.execute('PRAGMA foreign_keys');
    expect(rows[0].foreign_keys).toBe(1);
    db.close();
  });

  it('cascades session -> workout_exercise -> exercise_set deletes', () => {
    const db = createInMemoryDb();
    // Seed minimal lookups + exercise + session chain, then delete the session.
    db.execute("INSERT INTO muscle_group (name) VALUES ('biceps')");
    db.execute("INSERT INTO equipment (name) VALUES ('barbell')");
    db.execute(
      "INSERT INTO exercise (name, primary_muscle_group_id, equipment_id) VALUES ('Curl', 1, 1)",
    );
    db.execute("INSERT INTO workout_session (started_at) VALUES ('2026-01-01T00:00:00Z')");
    db.execute(
      "INSERT INTO workout_exercise (session_id, exercise_id, sort_order) VALUES (1, 1, 0)",
    );
    db.execute(
      "INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps) VALUES (1, 0, 50, 10)",
    );
    db.execute('DELETE FROM workout_session');
    expect(db.execute('SELECT COUNT(*) AS c FROM workout_exercise').rows[0].c).toBe(0);
    expect(db.execute('SELECT COUNT(*) AS c FROM exercise_set').rows[0].c).toBe(0);
    db.close();
  });

  it('restricts deletion of an exercise referenced by history', () => {
    const db = createInMemoryDb();
    db.execute("INSERT INTO muscle_group (name) VALUES ('biceps')");
    db.execute("INSERT INTO equipment (name) VALUES ('barbell')");
    db.execute(
      "INSERT INTO exercise (name, primary_muscle_group_id, equipment_id) VALUES ('Curl', 1, 1)",
    );
    db.execute("INSERT INTO workout_session (started_at) VALUES ('2026-01-01T00:00:00Z')");
    db.execute(
      "INSERT INTO workout_exercise (session_id, exercise_id, sort_order) VALUES (1, 1, 0)",
    );
    // Deleting the exercise must be blocked by ON DELETE RESTRICT.
    expect(() => db.execute('DELETE FROM exercise WHERE id = 1')).toThrow();
    // The exercise is still there.
    expect(db.execute('SELECT COUNT(*) AS c FROM exercise').rows[0].c).toBe(1);
    db.close();
  });

  it('keeps migration 0001 in sync with schema.sql (drift guard)', () => {
    // Apply schema.sql directly via node:sqlite exec (multi-statement).
    const raw = new DatabaseSync(':memory:');
    // eslint-disable-next-line no-undef -- __dirname is a Node global; the RN eslint env doesn't define it.
    raw.exec(fs.readFileSync(path.resolve(__dirname, '../schema.sql'), 'utf8'));
    const rawTables = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);

    const db = createInMemoryDb();
    const migratedTables = tableNames(db);

    expect(new Set(rawTables)).toEqual(new Set(migratedTables));
    db.close();
    raw.close();
  });
});

describe('splitStatements', () => {
  it('splits on semicolons outside strings and comments', () => {
    const sql = [
      "-- a comment with a ; semicolon",
      "INSERT INTO t (x) VALUES ('a;b');",
      "INSERT INTO t (x) VALUES ('c');",
      'SELECT 1;',
    ].join('\n');
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toContain("'a;b'");
    expect(stmts[1]).toContain("'c'");
    expect(stmts[2]).toMatch(/^SELECT 1/);
  });
});