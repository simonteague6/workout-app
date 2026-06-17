// sessionQueries — reusable SQL for the live WorkoutSession (issue #3).
//
// Every function takes the db adapter as its first argument so the SAME code
// runs on-device (op-sqlite) and in Jest (node:sqlite in-memory). The
// workoutStore delegates here; nothing in the UI touches SQL directly.
//
// Conventions:
//   * Inserts use `INSERT ... RETURNING *` so callers read the full row back.
//   * Pair frequency is stored canonically (exercise_a_id < exercise_b_id)
//     so (bench,curl) and (curl,bench) collapse to one row.
//   * Warm-up sets (set_type = 'warmup') are excluded from volume/stats; drop
//     sets count toward volume but the rest timer fires only after the last
//     drop in a contiguous group (handled in workoutStore, which knows the set
//     sequence; this module just records rest_timer_duration).

const SET_TYPES = new Set(['normal', 'warmup', 'dropset', 'failure']);


// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a WorkoutSession. Free-flow passes routineId = null; routine-driven
 * sessions pass the routine id. Returns the full session row.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ routineId?: number|null, bodyWeight?: number|null, startedAt?: string|null }} [opts]
 */
export function createSession(db, { routineId = null, bodyWeight = null, startedAt = null } = {}) {
  const cols = ['routine_id', 'body_weight'];
  const params = [routineId, bodyWeight];
  if (startedAt) {
    cols.push('started_at');
    params.push(startedAt);
  }
  const sql = `
    INSERT INTO workout_session (${cols.join(', ')})
      VALUES (${cols.map(() => '?').join(', ')})
      RETURNING *
  `;
  let row;
  db.transaction(() => {
    const { rows } = db.execute(sql, params);
    row = rows[0];
  });
  return row;
}

/**
 * Return the most recent unfinished WorkoutSession (is_completed = 0), or
 * null. Used by resumeInterrupted after an app restart.
 */
export function getActiveSession(db) {
  const { rows } = db.execute(
    `SELECT * FROM workout_session WHERE is_completed = 0
     ORDER BY started_at DESC, id DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Exercises within a session + pair-frequency suggestions
// ---------------------------------------------------------------------------

/**
 * Increment the pair-frequency counter for (exerciseAId, exerciseBId). The
 * pair is canonicalized to (min, max) so order never matters. Self-pairs and
 * null ids are skipped (a pair needs two distinct exercises).
 */
export function incrementPairFrequency(db, exerciseAId, exerciseBId) {
  if (exerciseAId == null || exerciseBId == null || exerciseAId === exerciseBId) return;
  const lo = Math.min(exerciseAId, exerciseBId);
  const hi = Math.max(exerciseAId, exerciseBId);
  db.execute(
    `INSERT INTO exercise_pair_frequency (exercise_a_id, exercise_b_id, count)
       VALUES (?, ?, 1)
     ON CONFLICT(exercise_a_id, exercise_b_id) DO UPDATE SET count = count + 1`,
    [lo, hi],
  );
}

/**
 * Append a WorkoutExercise to a session. sort_order is computed as the next
 * position after the current last exercise, and the pair-frequency counter is
 * bumped for (previous_exercise, new_exercise). Returns the new row.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ sessionId: number, exerciseId: number, substitutedFromRoutineExerciseId?: number|null }} input
 */
export function addWorkoutExercise(db, { sessionId, exerciseId, substitutedFromRoutineExerciseId = null }) {
  let row;
  db.transaction(() => {
    const next = db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM workout_exercise WHERE session_id = ?`,
      [sessionId],
    ).rows[0].next;
    const { rows } = db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id, sort_order, substituted_from_routine_exercise_id)
         VALUES (?, ?, ?, ?)
       RETURNING *`,
      [sessionId, exerciseId, next, substitutedFromRoutineExerciseId],
    );
    row = rows[0];

    // The exercise added just before this one is the previous pair partner.
    const prev = db.execute(
      `SELECT exercise_id FROM workout_exercise
        WHERE session_id = ? AND sort_order < ?
        ORDER BY sort_order DESC LIMIT 1`,
      [sessionId, next],
    ).rows[0];
    if (prev) incrementPairFrequency(db, prev.exercise_id, exerciseId);
  });
  return row;
}

/**
 * Exercises for the add-exercise modal, sorted by pair-frequency DESC with the
 * last exercise, then usage frequency, then name. Archived exercises are
 * excluded. Pass lastExerciseId = null for usage-frequency-only ordering.
 * @returns {object[]} rows: { id, name, primary_muscle_group_id, equipment_id, exercise_type, is_custom, is_archived, pair_count, usage_count }
 */
export function getExerciseSuggestions(db, { lastExerciseId = null, query = '' } = {}) {
  const like = query ? `%${query.toLowerCase()}%` : null;
  const conditions = ['e.is_archived = 0'];
  const params = [];
  if (like) {
    conditions.push('LOWER(e.name) LIKE ?');
    params.push(like);
  }
  // pair-frequency join: the pair with lastExerciseId lives at (min, max), so
  // match either orientation. When there is no last exercise, pair_count is 0.
  const pairJoin =
    lastExerciseId != null
      ? `LEFT JOIN exercise_pair_frequency pf
           ON (pf.exercise_a_id = ? AND pf.exercise_b_id = e.id)
           OR (pf.exercise_b_id = ? AND pf.exercise_a_id = e.id)`
      : 'LEFT JOIN exercise_pair_frequency pf ON 0';
  const pairParams = lastExerciseId != null ? [lastExerciseId, lastExerciseId] : [];

  const sql = `
    SELECT e.id, e.name, e.primary_muscle_group_id, e.equipment_id,
           e.exercise_type, e.is_custom, e.is_archived,
           COALESCE(pf.count, 0) AS pair_count,
           COALESCE(u.usage_count, 0) AS usage_count
      FROM exercise e
      ${pairJoin}
      LEFT JOIN (
        SELECT exercise_id AS eid, COUNT(*) AS usage_count
          FROM workout_exercise GROUP BY exercise_id
      ) u ON u.eid = e.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY pair_count DESC, usage_count DESC, e.name COLLATE NOCASE ASC
  `;
  const { rows } = db.execute(sql, [...pairParams, ...params]);
  return rows;
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

/**
 * The most recent completed non-warm-up set of an exercise, across all prior
 * sessions. Used to pre-fill new sets and for the "previous column".
 * @returns {{ weight: number|null, reps: number|null } | null}
 */
export function getPreviousSetForExercise(db, exerciseId) {
  const { rows } = db.execute(
    `SELECT es.weight, es.reps
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
       JOIN workout_session ws ON ws.id = we.session_id
      WHERE we.exercise_id = ? AND es.is_completed = 1 AND es.set_type != 'warmup'
      ORDER BY ws.started_at DESC, es.sort_order DESC
      LIMIT 1`,
    [exerciseId],
  );
  return rows[0] ? { weight: rows[0].weight, reps: rows[0].reps } : null;
}

/**
 * All sets of the most recent prior session that used an exercise, ordered by
 * sort_order. Drives the "previous column" shown beside each set row. Pass
 * excludeSessionId to ignore the current session. Returns [] when no history.
 * @returns {{ weight: number|null, reps: number|null, set_type: string, sort_order: number }[]}
 */
export function getLastSessionSetsForExercise(db, exerciseId, { excludeSessionId = null } = {}) {
  const conds = ['we.exercise_id = ?'];
  const params = [exerciseId];
  if (excludeSessionId != null) {
    conds.push('we.session_id != ?');
    params.push(excludeSessionId);
  }
  const session = db.execute(
    `SELECT ws.id AS sid
       FROM workout_session ws
       JOIN workout_exercise we ON we.session_id = ws.id
      WHERE ${conds.join(' AND ')}
      ORDER BY ws.started_at DESC
      LIMIT 1`,
    params,
  ).rows[0];
  if (!session) return [];
  const { rows } = db.execute(
    `SELECT es.weight, es.reps, es.set_type, es.sort_order
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
      WHERE we.session_id = ? AND we.exercise_id = ?
      ORDER BY es.sort_order`,
    [session.sid, exerciseId],
  );
  return rows;
}

/**
 * Append an ExerciseSet to a workout_exercise. weight/reps are pre-filled from
 * the last completed non-warm-up set of that exercise in a PRIOR session (so the
 * current session's own earlier sets don't feed back into themselves). Returns
 * the new set row.
 */
export function addSet(db, { workoutExerciseId }) {
  let row;
  db.transaction(() => {
    const we = db.execute(
      `SELECT exercise_id, session_id FROM workout_exercise WHERE id = ?`,
      [workoutExerciseId],
    ).rows[0];
    const next = db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM exercise_set WHERE workout_exercise_id = ?`,
      [workoutExerciseId],
    ).rows[0].next;

    // Pre-fill from the most recent completed non-warm-up set in another session.
    const prev = db.execute(
      `SELECT es.weight, es.reps
         FROM exercise_set es
         JOIN workout_exercise we ON we.id = es.workout_exercise_id
         JOIN workout_session ws ON ws.id = we.session_id
        WHERE we.exercise_id = ? AND es.is_completed = 1 AND es.set_type != 'warmup'
          AND we.session_id != ?
        ORDER BY ws.started_at DESC, es.sort_order DESC
        LIMIT 1`,
      [we.exercise_id, we.session_id],
    ).rows[0];

    const { rows } = db.execute(
      `INSERT INTO exercise_set (workout_exercise_id, sort_order, weight, reps)
         VALUES (?, ?, ?, ?)
       RETURNING *`,
      [workoutExerciseId, next, prev?.weight ?? null, prev?.reps ?? null],
    );
    row = rows[0];
  });
  return row;
}

/** Mark a set complete and record the rest duration that was used. */
export function completeSet(db, setId, { restDuration = null } = {}) {
  const { rows } = db.execute(
    `UPDATE exercise_set SET is_completed = 1, rest_timer_duration = ?
      WHERE id = ? RETURNING *`,
    [restDuration, setId],
  );
  return rows[0];
}

/** Update the set-type marker (normal | warmup | dropset | failure). */
export function updateSetType(db, setId, setType) {
  if (!SET_TYPES.has(setType)) {
    throw new Error(`sessionQueries.updateSetType: invalid set_type "${setType}"`);
  }
  const { rows } = db.execute(
    `UPDATE exercise_set SET set_type = ? WHERE id = ? RETURNING *`,
    [setType, setId],
  );
  return rows[0];
}

/** Partially update weight / reps / rpe on a set. */
export function updateSetFields(db, setId, patch) {
  const allowed = ['weight', 'reps', 'rpe'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(patch[key]);
    }
  }
  if (sets.length === 0) {
    return db.execute(`SELECT * FROM exercise_set WHERE id = ?`, [setId]).rows[0];
  }
  params.push(setId);
  const { rows } = db.execute(
    `UPDATE exercise_set SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
    params,
  );
  return rows[0];
}

/** Remove a set. */
export function deleteSet(db, setId) {
  db.execute(`DELETE FROM exercise_set WHERE id = ?`, [setId]);
}

/** All sets for a workout_exercise, ordered by sort_order. */
export function getSetsForWorkoutExercise(db, workoutExerciseId) {
  const { rows } = db.execute(
    `SELECT * FROM exercise_set WHERE workout_exercise_id = ? ORDER BY sort_order`,
    [workoutExerciseId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Session detail / listing
// ---------------------------------------------------------------------------

/** WorkoutExercise rows for a session with resolved exercise name + superset
 *  group membership, ordered by sort_order. */
export function getWorkoutExercisesForSession(db, sessionId) {
  const { rows } = db.execute(
    `SELECT we.*, e.name, sm.superset_group_id
       FROM workout_exercise we
       JOIN exercise e ON e.id = we.exercise_id
       LEFT JOIN superset_member sm ON sm.workout_exercise_id = we.id
      WHERE we.session_id = ?
      ORDER BY we.sort_order`,
    [sessionId],
  );
  return rows;
}

/**
 * Full nested session shape for rendering / resume:
 *   { ...session, exercises: [ { ...workoutExerciseRow, exercise: {id,name,...},
 *       sets: [...], supersetGroupId: number|null } ] }
 */
export function getSessionDetail(db, sessionId) {
  const session = db.execute(`SELECT * FROM workout_session WHERE id = ?`, [sessionId]).rows[0];
  if (!session) return null;
  const exRows = getWorkoutExercisesForSession(db, sessionId);
  const exercises = exRows.map((we) => ({
    ...we,
    exercise: { id: we.exercise_id, name: we.name },
    sets: getSetsForWorkoutExercise(db, we.id),
    supersetGroupId: we.superset_group_id ?? null,
  }));
  return { ...session, exercises };
}

// ---------------------------------------------------------------------------
// Exercise-level edits: substitute / remove / reorder / notes
// ---------------------------------------------------------------------------

/** Swap the exercise referenced by a workout_exercise (keeps history link). */
export function substituteExercise(db, workoutExerciseId, newExerciseId) {
  const { rows } = db.execute(
    `UPDATE workout_exercise SET exercise_id = ? WHERE id = ? RETURNING *`,
    [newExerciseId, workoutExerciseId],
  );
  return rows[0];
}

/**
 * After a substitute (exercise_id already swapped), re-pre-fill each set's
 * weight from the substitute exercise's last-session-per-index history. The
 * target set count + reps are inherited from the original routine exercise
 * (kept unchanged); only the pre-filled weight comes from the substitute's
 * history. Sets with no matching history index keep a null weight. PRD story 18.
 */
export function rePrefillSetWeightsForSubstitute(db, workoutExerciseId) {
  const we = db
    .execute(`SELECT exercise_id, session_id FROM workout_exercise WHERE id = ?`, [workoutExerciseId])
    .rows[0];
  if (!we) return;
  const lastSets = getLastSessionSetsForExercise(db, we.exercise_id, { excludeSessionId: we.session_id });
  const sets = db
    .execute(`SELECT id, sort_order FROM exercise_set WHERE workout_exercise_id = ? ORDER BY sort_order`, [
      workoutExerciseId,
    ])
    .rows;
  db.transaction(() => {
    sets.forEach((s) => {
      const prev = lastSets[s.sort_order];
      const weight = prev ? prev.weight : null;
      db.execute(`UPDATE exercise_set SET weight = ? WHERE id = ?`, [weight, s.id]);
    });
  });
}

/** Remove a workout_exercise (cascades to its sets + superset membership). */
export function removeWorkoutExercise(db, workoutExerciseId) {
  db.execute(`DELETE FROM workout_exercise WHERE id = ?`, [workoutExerciseId]);
}

/** Rewrite sort_order for the given workout_exercise ids in the given order. */
export function reorderWorkoutExercises(db, sessionId, orderedIds) {
  db.transaction(() => {
    orderedIds.forEach((id, i) => {
      db.execute(`UPDATE workout_exercise SET sort_order = ? WHERE id = ? AND session_id = ?`, [i, id, sessionId]);
    });
  });
}

/** Set the sticky notes on a workout_exercise. */
export function setWorkoutExerciseNotes(db, workoutExerciseId, notes) {
  const { rows } = db.execute(
    `UPDATE workout_exercise SET notes = ? WHERE id = ? RETURNING *`,
    [notes, workoutExerciseId],
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Supersets
// ---------------------------------------------------------------------------

/**
 * Pair two (or more) workout_exercises into a superset group. Returns the new
 * superset_group id. Members keep their display order via sort_order.
 */
export function createSuperset(db, sessionId, workoutExerciseIds) {
  let groupId;
  db.transaction(() => {
    const { rows } = db.execute(
      `INSERT INTO superset_group (session_id) VALUES (?) RETURNING id`,
      [sessionId],
    );
    groupId = rows[0].id;
    workoutExerciseIds.forEach((weId, i) => {
      // A workout_exercise can only belong to one superset (UNIQUE constraint);
      // remove any prior membership before re-adding.
      db.execute(`DELETE FROM superset_member WHERE workout_exercise_id = ?`, [weId]);
      db.execute(
        `INSERT INTO superset_member (superset_group_id, workout_exercise_id, sort_order)
           VALUES (?, ?, ?)`,
        [groupId, weId, i],
      );
    });
  });
  return groupId;
}

/** All superset groups in a session with their member workout_exercise ids. */
export function getSupersetGroups(db, sessionId) {
  const groups = db.execute(
    `SELECT id FROM superset_group WHERE session_id = ? ORDER BY id`,
    [sessionId],
  ).rows;
  return groups.map((g) => ({
    groupId: g.id,
    workoutExerciseIds: db.execute(
      `SELECT workout_exercise_id FROM superset_member WHERE superset_group_id = ? ORDER BY sort_order`,
      [g.id],
    ).rows.map((r) => r.workout_exercise_id),
  }));
}

/** Remove a workout_exercise from its superset; drop the group if emptied. */
export function removeFromSuperset(db, workoutExerciseId) {
  db.transaction(() => {
    const group = db.execute(
      `SELECT superset_group_id FROM superset_member WHERE workout_exercise_id = ?`,
      [workoutExerciseId],
    ).rows[0];
    db.execute(`DELETE FROM superset_member WHERE workout_exercise_id = ?`, [workoutExerciseId]);
    if (group) {
      const remaining = db.execute(
        `SELECT 1 FROM superset_member WHERE superset_group_id = ? LIMIT 1`,
        [group.superset_group_id],
      ).rows.length;
      if (remaining === 0) {
        db.execute(`DELETE FROM superset_group WHERE id = ?`, [group.superset_group_id]);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Finish + stats
// ---------------------------------------------------------------------------

/** Mark a session finished (finished_at = now, is_completed = 1). */
export function finishSession(db, sessionId, { bodyWeight = null, notes = null } = {}) {
  const sets = ['finished_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')', 'is_completed = 1'];
  const params = [];
  if (bodyWeight != null) {
    sets.push('body_weight = ?');
    params.push(bodyWeight);
  }
  if (notes != null) {
    sets.push('notes = ?');
    params.push(notes);
  }
  params.push(sessionId);
  const { rows } = db.execute(
    `UPDATE workout_session SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
    params,
  );
  return rows[0];
}

/** Total volume (kg*reps) for a session, excluding warm-up + uncompleted sets. */
export function getVolumeForSession(db, sessionId) {
  const { rows } = db.execute(
    `SELECT COALESCE(SUM(COALESCE(es.weight, 0) * COALESCE(es.reps, 0)), 0) AS volume
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
      WHERE we.session_id = ? AND es.is_completed = 1 AND es.set_type != 'warmup'`,
    [sessionId],
  );
  return rows[0].volume;
}

/**
 * Session stats for the finish screen.
 * @returns {{ volume: number, durationSeconds: number, setCount: number, exerciseCount: number }}
 */
export function getSessionStats(db, sessionId) {
  const session = db.execute(`SELECT started_at, finished_at FROM workout_session WHERE id = ?`, [
    sessionId,
  ]).rows[0];
  const volume = getVolumeForSession(db, sessionId);
  const counts = db.execute(
    `SELECT
       (SELECT COUNT(*) FROM workout_exercise WHERE session_id = ?) AS exercise_count,
       (SELECT COUNT(*) FROM exercise_set es JOIN workout_exercise we ON we.id = es.workout_exercise_id
          WHERE we.session_id = ? AND es.is_completed = 1) AS set_count`,
    [sessionId, sessionId],
  ).rows[0];

  let durationSeconds = 0;
  if (session?.started_at) {
    const end = session.finished_at ? Date.parse(session.finished_at) : Date.now();
    durationSeconds = Math.max(0, Math.floor((end - Date.parse(session.started_at)) / 1000));
  }
  return {
    volume,
    durationSeconds,
    setCount: counts.set_count,
    exerciseCount: counts.exercise_count,
  };
}

/**
 * Save a free-flow session as a reusable routine: create a routine row + one
 * routine_exercise per workout_exercise, with target sets/reps derived from
 * the session's completed sets. Returns the new routine id. (Free-flow finish
 * screen "save as template" — routines are fully built out in issue #4.)
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} sessionId
 * @param {string} name
 * @returns {number} routine id
 */
export function saveSessionAsTemplate(db, sessionId, name) {
  let routineId;
  db.transaction(() => {
    const { rows } = db.execute(`INSERT INTO routine (name) VALUES (?) RETURNING id`, [name]);
    routineId = rows[0].id;
    const exercises = db.execute(
      `SELECT we.id, we.exercise_id, we.sort_order
         FROM workout_exercise we WHERE we.session_id = ? ORDER BY we.sort_order`,
      [sessionId],
    ).rows;
    exercises.forEach((we) => {
      const sets = db.execute(
        `SELECT weight, reps FROM exercise_set WHERE workout_exercise_id = ? AND is_completed = 1
          ORDER BY sort_order`,
        [we.id],
      ).rows;
      const targetSets = sets.length;
      const repsMin = sets.length ? Math.min(...sets.map((s) => s.reps ?? 0)) : 5;
      const repsMax = sets.length ? Math.max(...sets.map((s) => s.reps ?? 0)) : 12;
      db.execute(
        `INSERT INTO routine_exercise
           (routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [routineId, we.exercise_id, we.sort_order, Math.max(1, targetSets), repsMin, repsMax],
      );
    });
  });
  return routineId;
}