import { describe, it, expect } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises, buildExerciseRows, mapCategory } from '../seed/seed.js';
import exerciseData from '../seed/exercises.json';

const exercises = exerciseData.exercises;

describe('seed script', () => {
  it('inserts the full wrkout exercise library and lookups', () => {
    const db = createInMemoryDb();
    const result = seedExercises(db);
    expect(result.exercises).toBe(exercises.length);
    expect(result.exercises).toBeGreaterThan(0);
    expect(result.muscleGroups).toBeGreaterThan(0);
    expect(result.equipment).toBeGreaterThan(0);
    db.close();
  });

  it('maps every wrkout field correctly for a known exercise (Barbell Curl)', () => {
    const db = createInMemoryDb();
    seedExercises(db);
    const { rows } = db.execute(
      `SELECT e.*,
              mg.name AS primary_muscle,
              sm.name AS secondary_muscle,
              eq.name AS equipment
       FROM exercise e
       LEFT JOIN muscle_group mg ON mg.id = e.primary_muscle_group_id
       LEFT JOIN muscle_group sm ON sm.id = e.secondary_muscle_group_id
       LEFT JOIN equipment eq ON eq.id = e.equipment_id
       WHERE e.name = 'Barbell Curl'`,
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.primary_muscle).toBe('biceps');
    expect(row.secondary_muscle).toBe('forearms');
    expect(row.equipment).toBe('barbell');
    expect(row.exercise_type).toBe('strength');
    expect(row.force).toBe('pull');
    expect(row.mechanic).toBe('isolation');
    expect(row.level).toBe('beginner');
    expect(row.is_custom).toBe(0);
    expect(row.is_archived).toBe(0);
    // default_notes carries the first instruction step.
    expect(row.default_notes).toMatch(/Stand up with your torso upright/);
    db.close();
  });

  it('maps exercise_type from wrkout category (strength/cardio/flexibility)', () => {
    expect(mapCategory('strength')).toBe('strength');
    expect(mapCategory('powerlifting')).toBe('strength');
    expect(mapCategory('olympic weightlifting')).toBe('strength');
    expect(mapCategory('strongman')).toBe('strength');
    expect(mapCategory('plyometrics')).toBe('strength');
    expect(mapCategory('cardio')).toBe('cardio');
    expect(mapCategory('stretching')).toBe('flexibility');
  });

  it('stores a cardio exercise as exercise_type cardio', () => {
    const db = createInMemoryDb();
    seedExercises(db);
    const { rows } = db.execute(
      "SELECT COUNT(*) AS c FROM exercise WHERE exercise_type = 'cardio'",
    );
    expect(rows[0].c).toBe(exercises.filter((e) => mapCategory(e.category) === 'cardio').length);
    db.close();
  });

  it('leaves secondary_muscle_group_id null when wrkout has no secondary muscles', () => {
    const db = createInMemoryDb();
    seedExercises(db);
    const withSecondary = exercises.filter(
      (e) => Array.isArray(e.secondaryMuscles) && e.secondaryMuscles.length > 0,
    ).length;
    const { rows } = db.execute(
      'SELECT COUNT(*) AS c FROM exercise WHERE secondary_muscle_group_id IS NULL',
    );
    expect(rows[0].c).toBe(exercises.length - withSecondary);
    db.close();
  });

  it('is idempotent — re-seeding skips and leaves the library untouched', () => {
    const db = createInMemoryDb();
    const first = seedExercises(db);
    const second = seedExercises(db);
    expect(second.skipped).toBe(true);
    expect(second.exercises).toBe(first.exercises);
    db.close();
  });

  it('makes all seeded exercises queryable by name', () => {
    const db = createInMemoryDb();
    seedExercises(db);
    for (const e of exercises.slice(0, 20)) {
      const { rows } = db.execute('SELECT id FROM exercise WHERE name = ?', [e.name]);
      expect(rows).toHaveLength(1);
    }
    db.close();
  });

  it('buildExerciseRows resolves lookup ids without dropping any exercise', () => {
    const db = createInMemoryDb();
    // Populate lookups the way the seeder does, then transform.
    const muscleNames = [];
    const equipmentNames = [];
    for (const e of exercises) {
      muscleNames.push(...(e.primaryMuscles || []), ...(e.secondaryMuscles || []));
      if (e.equipment) equipmentNames.push(e.equipment);
    }
    db.executeBatch(
      [...new Set(muscleNames.filter(Boolean))].map((n) => ({
        sql: 'INSERT OR IGNORE INTO muscle_group (name) VALUES (?)',
        params: [n],
      })),
    );
    db.executeBatch(
      [...new Set(equipmentNames.filter(Boolean))].map((n) => ({
        sql: 'INSERT OR IGNORE INTO equipment (name) VALUES (?)',
        params: [n],
      })),
    );
    const muscleMap = new Map(
      db.execute('SELECT id, name FROM muscle_group').rows.map((r) => [r.name, r.id]),
    );
    const equipmentMap = new Map(
      db.execute('SELECT id, name FROM equipment').rows.map((r) => [r.name, r.id]),
    );
    const rows = buildExerciseRows(exercises, muscleMap, equipmentMap);
    expect(rows).toHaveLength(exercises.length);
    // Every row has a name and a valid exercise_type.
    for (const r of rows) {
      expect(typeof r.name).toBe('string');
      expect(r.name.length).toBeGreaterThan(0);
      expect(['strength', 'cardio', 'flexibility']).toContain(r.exercise_type);
    }
    db.close();
  });
});