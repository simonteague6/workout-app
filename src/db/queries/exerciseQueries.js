// exerciseQueries — reusable SQL for the Exercise Library (issue #2).
//
// Every function takes the db adapter as its first argument so the SAME code
// runs on-device (op-sqlite) and in Jest (node:sqlite in-memory). Stores call
// getDatabase() and pass it in; query tests pass createInMemoryDb().
//
// Built-in and custom exercises live in one table with equal standing, so
// none of these queries filter by is_custom unless asked. Search excludes
// archived rows by default (soft-delete preserves history); pass
// includeArchived to surface them.
//
// Row shape returned by search/get (names resolved + usage stats):
//   { id, name, primary_muscle_group_id, primary_muscle,
//     secondary_muscle_group_id, secondary_muscle, equipment_id, equipment,
//     default_notes, default_increment, default_rep_range_min,
//     default_rep_range_max, default_rest_seconds, exercise_type, force,
//     mechanic, level, is_custom, is_archived, photo_path,
//     usage_count, last_performed_at, created_at, updated_at }

const TYPE_VALUES = new Set(['strength', 'cardio', 'flexibility']);
const FORCE_VALUES = new Set([null, 'push', 'pull', 'static']);
const MECHANIC_VALUES = new Set([null, 'compound', 'isolation']);

// Columns selected for the resolved exercise row (with joined names + usage).
const RESOLVED_SELECT = `
  e.id, e.name,
  e.primary_muscle_group_id, pm.name AS primary_muscle,
  e.secondary_muscle_group_id, sm.name AS secondary_muscle,
  e.equipment_id, eq.name AS equipment,
  e.default_notes, e.default_increment,
  e.default_rep_range_min, e.default_rep_range_max, e.default_rest_seconds,
  e.exercise_type, e.force, e.mechanic, e.level,
  e.is_custom, e.is_archived, e.photo_path, e.created_at, e.updated_at,
  COALESCE(usage.usage_count, 0) AS usage_count,
  usage.last_performed_at
`;

// Usage stats per exercise: how many workout_exercise rows reference it and
// the most recent session started_at. LEFT JOINed so never-used exercises get
// usage_count 0 / last_performed_at null.
const USAGE_SUBQUERY = `
  LEFT JOIN (
    SELECT we.exercise_id,
           COUNT(*)            AS usage_count,
           MAX(ws.started_at)  AS last_performed_at
      FROM workout_exercise we
      JOIN workout_session ws ON ws.id = we.session_id
     GROUP BY we.exercise_id
  ) usage ON usage.exercise_id = e.id
`;

const NAME_JOINS = `
  LEFT JOIN muscle_group pm ON pm.id = e.primary_muscle_group_id
  LEFT JOIN muscle_group sm ON sm.id = e.secondary_muscle_group_id
  LEFT JOIN equipment     eq ON eq.id = e.equipment_id
`;

// ---------------------------------------------------------------------------
// Lookup options for pickers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LookupOption
 * @property {number} id
 * @property {string} name
 */

/**
 * Load muscle groups + equipment for picker UIs. Ordered alphabetically.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @returns {{ muscleGroups: LookupOption[], equipment: LookupOption[] }}
 */
export function getLookupOptions(db) {
  const { rows: muscleGroups } = db.execute(
    'SELECT id, name FROM muscle_group ORDER BY name COLLATE NOCASE ASC',
  );
  const { rows: equipment } = db.execute(
    'SELECT id, name FROM equipment ORDER BY name COLLATE NOCASE ASC',
  );
  return { muscleGroups, equipment };
}

// ---------------------------------------------------------------------------
// Search / list
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SearchParams
 * @property {string} [query]        name fragment (case-insensitive LIKE)
 * @property {number} [muscleGroupId] matches primary OR secondary muscle
 * @property {number} [equipmentId]
 * @property {string} [exerciseType]  strength | cardio | flexibility
 * @property {boolean} [includeArchived=false]
 * @property {number} [limit]
 */

/**
 * Search the exercise library. Results are sorted by usage frequency
 * (most-used first) then name, so go-to exercises surface first and ties are
 * deterministic. Archived rows are excluded unless includeArchived is set.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {SearchParams} [params]
 * @returns {object[]} resolved exercise rows
 */
export function searchExercises(db, params = {}) {
  const {
    query,
    muscleGroupId,
    equipmentId,
    exerciseType,
    includeArchived = false,
    limit,
  } = params;

  const where = [];
  const sqlParams = [];

  if (!includeArchived) where.push('e.is_archived = 0');
  if (query && query.trim()) {
    where.push('e.name LIKE ?');
    sqlParams.push(`%${query.trim()}%`);
  }
  if (muscleGroupId != null) {
    where.push('(e.primary_muscle_group_id = ? OR e.secondary_muscle_group_id = ?)');
    sqlParams.push(muscleGroupId, muscleGroupId);
  }
  if (equipmentId != null) {
    where.push('e.equipment_id = ?');
    sqlParams.push(equipmentId);
  }
  if (exerciseType) {
    where.push('e.exercise_type = ?');
    sqlParams.push(exerciseType);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitClause = limit != null ? `LIMIT ${Number(limit)}` : '';

  const sql = `
    SELECT ${RESOLVED_SELECT}
      FROM exercise e
      ${NAME_JOINS}
      ${USAGE_SUBQUERY}
      ${whereClause}
      ORDER BY usage_count DESC, e.name COLLATE NOCASE ASC
      ${limitClause}
  `;
  const { rows } = db.execute(sql, sqlParams);
  return rows;
}

/**
 * Fetch one resolved exercise row by id (archived or not).
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} id
 * @returns {object|null}
 */
export function getExerciseById(db, id) {
  const sql = `
    SELECT ${RESOLVED_SELECT}
      FROM exercise e
      ${NAME_JOINS}
      ${USAGE_SUBQUERY}
     WHERE e.id = ?
     LIMIT 1
  `;
  const { rows } = db.execute(sql, [id]);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Create / update / archive / photo
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ExerciseInput
 * @property {string} name                          required, unique
 * @property {number|null} [primary_muscle_group_id]
 * @property {number|null} [secondary_muscle_group_id]
 * @property {number|null} [equipment_id]
 * @property {string} [default_notes]
 * @property {number} [default_increment]
 * @property {number} [default_rep_range_min]
 * @property {number} [default_rep_range_max]
 * @property {number} [default_rest_seconds]
 * @property {string} [exercise_type]               strength | cardio | flexibility
 * @property {string|null} [force]                   push | pull | static
 * @property {string|null} [mechanic]               compound | isolation
 * @property {string|null} [level]
 */

function validateInput(input, { requireName = true } = {}) {
  if (requireName) {
    const name = (input?.name ?? '').toString().trim();
    if (!name) throw new Error('Exercise name is required');
  }
  if (input?.exercise_type && !TYPE_VALUES.has(input.exercise_type)) {
    throw new Error(`Invalid exercise_type "${input.exercise_type}"`);
  }
  if (input?.force != null && !FORCE_VALUES.has(input.force)) {
    throw new Error(`Invalid force "${input.force}"`);
  }
  if (input?.mechanic != null && !MECHANIC_VALUES.has(input.mechanic)) {
    throw new Error(`Invalid mechanic "${input.mechanic}"`);
  }
  if (input?.default_rep_range_min != null && input?.default_rep_range_max != null) {
    if (Number(input.default_rep_range_min) > Number(input.default_rep_range_max)) {
      throw new Error('default_rep_range_min cannot exceed default_rep_range_max');
    }
  }
}

/**
 * Create a custom exercise (is_custom = 1). Returns the resolved row.
 * Throws on missing/empty name, duplicate name, or invalid enum values.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {ExerciseInput} input
 * @returns {object} resolved exercise row
 */
export function createCustomExercise(db, input) {
  validateInput(input);
  const name = input.name.toString().trim();

  const cols = [
    'name',
    'primary_muscle_group_id',
    'secondary_muscle_group_id',
    'equipment_id',
    'default_notes',
    'default_increment',
    'default_rep_range_min',
    'default_rep_range_max',
    'default_rest_seconds',
    'exercise_type',
    'force',
    'mechanic',
    'level',
    'is_custom',
  ];
  const values = [
    name,
    input.primary_muscle_group_id ?? null,
    input.secondary_muscle_group_id ?? null,
    input.equipment_id ?? null,
    input.default_notes ?? null,
    input.default_increment ?? undefined,
    input.default_rep_range_min ?? undefined,
    input.default_rep_range_max ?? undefined,
    input.default_rest_seconds ?? undefined,
    input.exercise_type ?? 'strength',
    input.force ?? null,
    input.mechanic ?? null,
    input.level ?? null,
    1,
  ];

  // Drop undefined so column DEFAULTs apply (increment/rep range/rest).
  const colList = [];
  const placeholderList = [];
  const params = [];
  for (let i = 0; i < cols.length; i++) {
    if (values[i] === undefined) continue;
    colList.push(cols[i]);
    placeholderList.push('?');
    params.push(values[i]);
  }

  const sql = `
    INSERT INTO exercise (${colList.join(', ')})
      VALUES (${placeholderList.join(', ')})
      RETURNING id
  `;
  let inserted;
  db.transaction(() => {
    const { rows } = db.execute(sql, params);
    inserted = rows[0]?.id;
  });
  if (inserted == null) {
    throw new Error(`Failed to create exercise "${name}" (name may already exist)`);
  }
  return getExerciseById(db, inserted);
}

/**
 * Update editable metadata on any exercise (built-in or custom). Only the
 * supplied fields are written. Returns the resolved row.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} id
 * @param {Partial<ExerciseInput>} patch
 * @returns {object} resolved exercise row
 */
export function updateExercise(db, id, patch) {
  validateInput(patch, { requireName: false });
  if (patch.name != null) patch = { ...patch, name: patch.name.toString().trim() };

  const editable = [
    'name',
    'primary_muscle_group_id',
    'secondary_muscle_group_id',
    'equipment_id',
    'default_notes',
    'default_increment',
    'default_rep_range_min',
    'default_rep_range_max',
    'default_rest_seconds',
    'exercise_type',
    'force',
    'mechanic',
    'level',
    'photo_path',
    'is_archived',
  ];

  const sets = [];
  const params = [];
  for (const col of editable) {
    if (patch[col] === undefined) continue;
    sets.push(`${col} = ?`);
    params.push(patch[col]);
  }
  if (sets.length === 0) {
    return getExerciseById(db, id);
  }
  sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
  params.push(id);

  const sql = `UPDATE exercise SET ${sets.join(', ')} WHERE id = ? RETURNING id`;
  let updated;
  db.transaction(() => {
    const { rows } = db.execute(sql, params);
    updated = rows[0]?.id;
  });
  if (updated == null) {
    throw new Error(`Failed to update exercise ${id} (it may not exist or name may clash)`);
  }
  return getExerciseById(db, updated);
}

/**
 * Soft-delete (archive) an exercise. Sets is_archived = 1 so it disappears
 * from default search while preserving every workout_exercise / exercise_set
 * row that references it (ON DELETE RESTRICT would block a hard delete anyway).
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} id
 * @returns {object} resolved exercise row (now archived)
 */
export function archiveExercise(db, id) {
  return updateExercise(db, id, { is_archived: 1 });
}

/**
 * Restore an archived exercise.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} id
 * @returns {object} resolved exercise row
 */
export function unarchiveExercise(db, id) {
  return updateExercise(db, id, { is_archived: 0 });
}

/**
 * Attach or replace the photo path for any exercise (built-in or custom).
 * Pass null to clear.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} id
 * @param {string|null} photoPath
 * @returns {object} resolved exercise row
 */
export function setPhotoPath(db, id, photoPath) {
  return updateExercise(db, id, { photo_path: photoPath });
}

// ---------------------------------------------------------------------------
// Per-exercise history (detail-card link target; reused by the History tab in #6)
// ---------------------------------------------------------------------------

/**
 * Chronological history for one exercise: every session that used it, with
 * each session's sets (weight × reps, set type, completion). Newest first.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} exerciseId
 * @returns {{ session_id: number, started_at: string, session_notes: string|null,
 *            exercise_notes: string|null, sets: object[] }[]}
 */
export function getExerciseHistory(db, exerciseId) {
  const sql = `
    SELECT ws.id            AS session_id,
           ws.started_at    AS started_at,
           ws.notes         AS session_notes,
           we.id            AS workout_exercise_id,
           we.notes         AS exercise_notes,
           we.sort_order    AS exercise_sort,
           es.id            AS set_id,
           es.sort_order    AS set_sort,
           es.weight        AS weight,
           es.reps          AS reps,
           es.set_type      AS set_type,
           es.is_completed  AS is_completed,
           es.rest_timer_duration AS rest_timer_duration
      FROM workout_exercise we
      JOIN workout_session ws ON ws.id = we.session_id
      LEFT JOIN exercise_set es ON es.workout_exercise_id = we.id
     WHERE we.exercise_id = ?
     ORDER BY ws.started_at DESC, we.sort_order ASC, es.sort_order ASC
  `;
  const { rows } = db.execute(sql, [exerciseId]);

  // Group flat rows into per-session objects with nested sets.
  const bySession = new Map();
  for (const r of rows) {
    let session = bySession.get(r.session_id);
    if (!session) {
      session = {
        session_id: r.session_id,
        started_at: r.started_at,
        session_notes: r.session_notes,
        exercise_notes: r.exercise_notes,
        sets: [],
      };
      bySession.set(r.session_id, session);
    }
    if (r.set_id != null) {
      session.sets.push({
        id: r.set_id,
        sort_order: r.set_sort,
        weight: r.weight,
        reps: r.reps,
        set_type: r.set_type,
        is_completed: r.is_completed,
        rest_timer_duration: r.rest_timer_duration,
      });
    }
  }
  return [...bySession.values()];
}