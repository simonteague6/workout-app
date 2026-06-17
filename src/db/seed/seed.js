// Seed script — transforms wrkout/exercises.json into SQLite INSERTs.
//
// The wrkout public dataset ({ exercises: [...] }, Unlicense) is bundled at
// src/db/seed/exercises.json and required directly (Metro + Node both inline
// JSON). This module is a pure transform: given a database adapter and the
// parsed dataset, it populates muscle_group, equipment, and exercise.
//
// Field mapping (see PRD §Exercise Data Seed):
//   name                 -> exercise.name
//   primaryMuscles[0]     -> primary_muscle_group_id   (lookup/insert)
//   secondaryMuscles[0]  -> secondary_muscle_group_id (lookup/insert, nullable)
//   equipment            -> equipment_id             (lookup/insert, nullable)
//   instructions[]       -> default_notes            (joined by blank line)
//   category             -> exercise_type            (see mapCategory below)
//   force                -> force                    (push/pull/static, preserved)
//   mechanic             -> mechanic                 (compound/isolation, preserved)
//   level                -> level                    (beginner/intermediate/expert)
//
// NOTE on exercise_type: PRD §Data Model lists exercise_type as
// strength/cardio/flexibility. The PRD seed note says "force -> exercise_type
// mapping", but force is push/pull/static (movement direction), not a
// strength/cardio/flexibility type. The semantically correct source is wrkout's
// `category` field. We map category -> exercise_type and still preserve force
// as its own column, so no source data is lost.
//
// NOTE on count: the public wrkout/exercises.json repo currently ships 873
// exercises (the 2,500+ figure in the PRD refers to the commercial wrkout.xyz
// dataset). The seed script is data-driven: feeding it a larger JSON yields a
// proportionally larger library with no code change.

import exerciseData from './exercises.json';

// wrkout `category` -> our exercise_type enum.
export function mapCategory(category) {
  switch ((category || '').toLowerCase()) {
    case 'cardio':
      return 'cardio';
    case 'stretching':
      return 'flexibility';
    case 'strength':
    case 'powerlifting':
    case 'strongman':
    case 'olympic weightlifting':
    case 'plyometrics':
      return 'strength';
    default:
      return 'strength';
  }
}

// Normalize a wrkout muscle/equipment string to a stable lookup key/name.
function normName(s) {
  return (s || '').toString().trim();
}

// Insert distinct lookup names (if absent) and return a name -> id map.
function syncLookup(db, table, names) {
  const unique = [...new Set(names.map(normName).filter(Boolean))];
  db.executeBatch(
    unique.map((name) => ({
      sql: `INSERT OR IGNORE INTO ${table} (name) VALUES (?)`,
      params: [name],
    })),
  );
  const { rows } = db.execute(`SELECT id, name FROM ${table}`);
  const map = new Map();
  for (const row of rows) map.set(row.name, row.id);
  return map;
}

// Take the first element of an array, or null. wrkout's primary/secondary
// muscles are arrays; our schema holds a single primary + single secondary.
function firstOr(arr) {
  return Array.isArray(arr) && arr.length > 0 ? normName(arr[0]) : null;
}

// Pure transform: build the exercise row tuples from the dataset + lookup maps.
export function buildExerciseRows(exercises, muscleMap, equipmentMap) {
  return exercises.map((e) => {
    const primary = firstOr(e.primaryMuscles);
    const secondary = firstOr(e.secondaryMuscles);
    const equipment = normName(e.equipment);
    const notes = Array.isArray(e.instructions) && e.instructions.length > 0
      ? e.instructions.join('\n\n')
      : null;
    return {
      name: normName(e.name),
      primary_muscle_group_id: primary ? muscleMap.get(primary) ?? null : null,
      secondary_muscle_group_id: secondary ? muscleMap.get(secondary) ?? null : null,
      equipment_id: equipment ? equipmentMap.get(equipment) ?? null : null,
      default_notes: notes,
      exercise_type: mapCategory(e.category),
      force: e.force ? normName(e.force) : null,
      mechanic: e.mechanic ? normName(e.mechanic) : null,
      level: e.level ? normName(e.level) : null,
      is_custom: 0,
      is_archived: 0,
    };
  });
}

// Seed the library into an already-migrated database. Idempotent: skips when
// exercises already exist. Returns { exercises, muscleGroups, equipment }.
export function seedExercises(db, data = exerciseData) {
  const exercises = data && data.exercises ? data.exercises : [];

  const existing = db.execute('SELECT COUNT(*) AS c FROM exercise').rows[0].c;
  if (existing > 0) {
    return { exercises: existing, skipped: true };
  }

  const muscleNames = [];
  const equipmentNames = [];
  for (const e of exercises) {
    muscleNames.push(...(e.primaryMuscles || []), ...(e.secondaryMuscles || []));
    if (e.equipment) equipmentNames.push(e.equipment);
  }
  const muscleMap = syncLookup(db, 'muscle_group', muscleNames);
  const equipmentMap = syncLookup(db, 'equipment', equipmentNames);

  const rows = buildExerciseRows(exercises, muscleMap, equipmentMap);

  db.transaction(() => {
    db.executeBatch(
      rows.map((r) => ({
        sql: `INSERT INTO exercise
          (name, primary_muscle_group_id, secondary_muscle_group_id, equipment_id,
           default_notes, exercise_type, force, mechanic, level, is_custom, is_archived)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          r.name,
          r.primary_muscle_group_id,
          r.secondary_muscle_group_id,
          r.equipment_id,
          r.default_notes,
          r.exercise_type,
          r.force,
          r.mechanic,
          r.level,
          r.is_custom,
          r.is_archived,
        ],
      })),
    );
  });

  return {
    exercises: db.execute('SELECT COUNT(*) AS c FROM exercise').rows[0].c,
    muscleGroups: db.execute('SELECT COUNT(*) AS c FROM muscle_group').rows[0].c,
    equipment: db.execute('SELECT COUNT(*) AS c FROM equipment').rows[0].c,
  };
}

// Convenience: open/initialize (or use provided) db, migrate, seed.
export function runSeed(db) {
  return seedExercises(db);
}