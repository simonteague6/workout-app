// routineQueries — reusable SQL for RoutineFolders + Routine templates (issue #4).
//
// Every function takes the db adapter as its first argument so the SAME code
// runs on-device (op-sqlite) and in Jest (node:sqlite in-memory). The
// routineStore delegates here; nothing in the UI touches SQL directly.
//
// Conventions:
//   * Inserts use `INSERT ... RETURNING *` so callers read the full row back.
//   * routine_exercise rows are normalized (NOT a JSON blob): one row per
//     exercise in a routine, with target_sets / target_reps_min /
//     target_reps_max / target_rest_seconds. sort_order is authoritative for
//     display order.
//   * workout_exercise.substituted_from_routine_exercise_id records the
//     routine_exercise a workout_exercise originated from (set for every
//     exercise in a routine-driven session, not only substitutions). A
//     substitution is detected by exercise_id differing from the
//     routine_exercise's exercise_id.

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/**
 * Create a RoutineFolder. Returns the new row.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {string} name  non-empty (trimmed)
 */
export function createFolder(db, name) {
  const trimmed = (name ?? '').toString().trim();
  if (!trimmed) throw new Error('routineQueries.createFolder: name is required');
  const { rows } = db.execute(
    `INSERT INTO routine_folder (name) VALUES (?) RETURNING *`,
    [trimmed],
  );
  return rows[0];
}

/**
 * All folders ordered by sort_order then id (so display stays stable).
 */
export function getFolders(db) {
  const { rows } = db.execute(
    `SELECT * FROM routine_folder ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Routine + routine_exercise CRUD
// ---------------------------------------------------------------------------

/**
 * Create a Routine + one routine_exercise per input exercise, with sort_order
 * assigned in the given order. Returns the new routine row.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ name: string, folderId?: number|null, exercises: Array<{ exerciseId: number, targetSets?: number, targetRepsMin?: number, targetRepsMax?: number, targetRestSeconds?: number }> }} input
 */
export function createRoutine(db, input) {
  const name = (input.name ?? '').toString().trim();
  if (!name) throw new Error('routineQueries.createRoutine: name is required');
  let routine;
  db.transaction(() => {
    const { rows } = db.execute(
      `INSERT INTO routine (folder_id, name) VALUES (?, ?) RETURNING *`,
      [input.folderId ?? null, name],
    );
    routine = rows[0];
    (input.exercises ?? []).forEach((ex, i) => {
      db.execute(
        `INSERT INTO routine_exercise
           (routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max, target_rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          routine.id,
          ex.exerciseId,
          i,
          ex.targetSets ?? 3,
          ex.targetRepsMin ?? 5,
          ex.targetRepsMax ?? 12,
          ex.targetRestSeconds ?? 90,
        ],
      );
    });
  });
  return routine;
}

/**
 * Full routine detail: routine row + its routine_exercise rows with the
 * resolved exercise name, ordered by sort_order. Returns null when the
 * routine does not exist.
 * @returns {{ id, folder_id, name, created_at, updated_at, exercises: Array<{ id, routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max, target_rest_seconds, exercise_name, primary_muscle_group_id }> } | null}
 */
export function getRoutineDetail(db, routineId) {
  const routine = db.execute(`SELECT * FROM routine WHERE id = ?`, [routineId]).rows[0];
  if (!routine) return null;
  const { rows } = db.execute(
    `SELECT re.*, e.name AS exercise_name, e.primary_muscle_group_id AS primary_muscle_group_id
       FROM routine_exercise re
       JOIN exercise e ON e.id = re.exercise_id
      WHERE re.routine_id = ?
      ORDER BY re.sort_order`,
    [routineId],
  );
  return { ...routine, exercises: rows };
}

/**
 * All routines with their folder name (null when unfiled) and exercise count,
 * ordered by name. Used by the routines list.
 * @returns {Array<{ id, folder_id, name, created_at, updated_at, folder_name: string|null, exercise_count: number }>}
 */
export function getRoutines(db) {
  const { rows } = db.execute(
    `SELECT r.id, r.folder_id, r.name, r.created_at, r.updated_at,
            f.name AS folder_name,
            COALESCE(c.exercise_count, 0) AS exercise_count
       FROM routine r
       LEFT JOIN routine_folder f ON f.id = r.folder_id
       LEFT JOIN (
         SELECT routine_id, COUNT(*) AS exercise_count FROM routine_exercise GROUP BY routine_id
       ) c ON c.routine_id = r.id
      ORDER BY r.name COLLATE NOCASE ASC, r.id ASC`,
  );
  return rows;
}

/**
 * Replace the routine_exercise rows for a routine with a new ordered list.
 * Used by the routine builder save: targets and order are authoritative from
 * the input. Existing routine_exercise ids are NOT preserved (the link from
 * historical workout_exercises.substituted_from_routine_exercise_id is ON
 * DELETE SET NULL, so history records keep their session data).
 * @param {Array<{ exerciseId: number, targetSets?: number, targetRepsMin?: number, targetRepsMax?: number, targetRestSeconds?: number }>} exercises
 */
export function setRoutineExercises(db, routineId, exercises) {
  db.transaction(() => {
    db.execute(`DELETE FROM routine_exercise WHERE routine_id = ?`, [routineId]);
    (exercises ?? []).forEach((ex, i) => {
      db.execute(
        `INSERT INTO routine_exercise
           (routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max, target_rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          routineId,
          ex.exerciseId,
          i,
          ex.targetSets ?? 3,
          ex.targetRepsMin ?? 5,
          ex.targetRepsMax ?? 12,
          ex.targetRestSeconds ?? 90,
        ],
      );
    });
  });
  return getRoutineDetail(db, routineId).exercises;
}

/** Rename a routine. Returns the updated row. */
export function renameRoutine(db, routineId, name) {
  const trimmed = (name ?? '').toString().trim();
  if (!trimmed) throw new Error('routineQueries.renameRoutine: name is required');
  const { rows } = db.execute(
    `UPDATE routine SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? RETURNING *`,
    [trimmed, routineId],
  );
  return rows[0];
}

/** Move a routine to a folder (pass folderId = null to unfile). Returns the updated row. */
export function moveRoutineToFolder(db, routineId, folderId) {
  const { rows } = db.execute(
    `UPDATE routine SET folder_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? RETURNING *`,
    [folderId, routineId],
  );
  return rows[0];
}

/**
 * Rewrite sort_order for the given routine_exercise ids in the given order.
 * Pass the routine_exercise ids in display order.
 */
export function reorderRoutineExercises(db, routineId, orderedIds) {
  db.transaction(() => {
    orderedIds.forEach((id, i) => {
      db.execute(
        `UPDATE routine_exercise SET sort_order = ? WHERE id = ? AND routine_id = ?`,
        [i, id, routineId],
      );
    });
  });
}

/** Delete a routine; cascades to its routine_exercise rows. */
export function deleteRoutine(db, routineId) {
  db.execute(`DELETE FROM routine WHERE id = ?`, [routineId]);
}

// ---------------------------------------------------------------------------
// Routine preview (last session performance per exercise)
// ---------------------------------------------------------------------------

/**
 * Routine detail enriched with the last completed session that used each
 * exercise (the "last session performance" shown on the routine preview
 * screen before starting). Returns null when the routine does not exist.
 *
 * Each exercise row gains `lastSession`: { sessionId, started_at, sets: [{ weight, reps, set_type, sort_order }] }
 * or null when the exercise has no history.
 * @returns {object|null}
 */
export function getRoutinePreview(db, routineId) {
  const detail = getRoutineDetail(db, routineId);
  if (!detail) return null;
  const exercises = detail.exercises.map((re) => {
    const session = db
      .execute(
        `SELECT ws.id AS session_id, ws.started_at
           FROM workout_session ws
           JOIN workout_exercise we ON we.session_id = ws.id
          WHERE we.exercise_id = ? AND ws.is_completed = 1
          ORDER BY ws.started_at DESC, ws.id DESC
          LIMIT 1`,
        [re.exercise_id],
      )
      .rows[0];
    let lastSession = null;
    if (session) {
      const sets = db
        .execute(
          `SELECT es.weight, es.reps, es.set_type, es.sort_order
             FROM exercise_set es
             JOIN workout_exercise we ON we.id = es.workout_exercise_id
            WHERE we.session_id = ? AND we.exercise_id = ?
            ORDER BY es.sort_order`,
          [session.session_id, re.exercise_id],
        )
        .rows;
      lastSession = { sessionId: session.session_id, started_at: session.started_at, sets };
    }
    return { ...re, lastSession };
  });
  return { ...detail, exercises };
}

// ---------------------------------------------------------------------------
// Routine vs session finish diff
// ---------------------------------------------------------------------------

/**
 * Build the git-diff-style comparison between a routine's planned exercises
 * and what actually happened in a session. Drives the finish screen for
 * routine-driven workouts (PRD story 25).
 *
 * Entry shape:
 *   { type: 'matched' | 'substituted' | 'skipped' | 'added',
 *     routineExerciseId, routineExerciseName, exerciseId, exerciseName,
 *     workoutExerciseId, substituteExerciseId, substituteExerciseName }
 *
 *   - matched     exercise performed as planned (exercise_id matches)
 *   - substituted exercise swapped for the session only (originated from the
 *                 routine_exercise but exercise_id differs)
 *   - skipped     routine exercise with no corresponding workout_exercise
 *   - added       extra exercise added during the session (no routine origin)
 *
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} routineId
 * @param {number} sessionId
 * @returns {object[]}
 */
export function getRoutineSessionDiff(db, routineId, sessionId) {
  const routine = getRoutineDetail(db, routineId);
  if (!routine) return [];
  const routineExercises = routine.exercises;

  // Session workout_exercises, with a count of completed sets per row.
  const sessionRows = db
    .execute(
      `SELECT we.id, we.exercise_id, we.substituted_from_routine_exercise_id,
              e.name AS exercise_name,
              (SELECT COUNT(*) FROM exercise_set es
                WHERE es.workout_exercise_id = we.id AND es.is_completed = 1) AS completed_sets
         FROM workout_exercise we
         JOIN exercise e ON e.id = we.exercise_id
        WHERE we.session_id = ?
        ORDER BY we.sort_order`,
      [sessionId],
    )
    .rows;

  // Map routine_exercise id -> the workout_exercise that originated from it.
  const byOrigin = new Map();
  for (const we of sessionRows) {
    if (we.substituted_from_routine_exercise_id != null) {
      byOrigin.set(we.substituted_from_routine_exercise_id, we);
    }
  }

  const diff = [];
  for (const re of routineExercises) {
    const we = byOrigin.get(re.id);
    if (!we || we.completed_sets === 0) {
      // No workout_exercise at all, or pre-loaded but zero sets completed → skipped.
      diff.push({
        type: 'skipped',
        routineExerciseId: re.id,
        routineExerciseName: re.exercise_name,
        exerciseId: re.exercise_id,
        exerciseName: re.exercise_name,
        workoutExerciseId: we?.id ?? null,
      });
    } else if (we.exercise_id === re.exercise_id) {
      diff.push({
        type: 'matched',
        routineExerciseId: re.id,
        routineExerciseName: re.exercise_name,
        exerciseId: re.exercise_id,
        exerciseName: re.exercise_name,
        workoutExerciseId: we.id,
      });
    } else {
      diff.push({
        type: 'substituted',
        routineExerciseId: re.id,
        routineExerciseName: re.exercise_name,
        exerciseId: re.exercise_id,
        exerciseName: re.exercise_name,
        workoutExerciseId: we.id,
        substituteExerciseId: we.exercise_id,
        substituteExerciseName: we.exercise_name,
      });
    }
  }
  // Extras: workout_exercises with no routine origin (added ad-hoc).
  for (const we of sessionRows) {
    if (we.substituted_from_routine_exercise_id == null && we.completed_sets > 0) {
      diff.push({
        type: 'added',
        routineExerciseId: null,
        routineExerciseName: null,
        exerciseId: we.exercise_id,
        exerciseName: we.exercise_name,
        workoutExerciseId: we.id,
      });
    }
  }
  return diff;
}

// ---------------------------------------------------------------------------
// Routine-from-session: save-as-new + update-template-from-session
// ---------------------------------------------------------------------------

/**
 * Derive routine_exercise targets from a session's workout_exercise:
 * target_sets = count of completed non-warm-up sets; target_reps_min/max =
 * min/max of those sets' reps; target_rest_seconds = the exercise's default.
 * Returns null when the workout_exercise had no completed sets.
 */
function deriveTargetsFromWorkoutExercise(db, we) {
  const sets = db
    .execute(
      `SELECT reps, set_type FROM exercise_set
        WHERE workout_exercise_id = ? AND is_completed = 1 AND set_type != 'warmup'
        ORDER BY sort_order`,
      [we.id],
    )
    .rows;
  if (sets.length === 0) return null;
  const reps = sets.map((s) => (s.reps == null ? 0 : s.reps));
  const restRow = db
    .execute(`SELECT default_rest_seconds FROM exercise WHERE id = ?`, [we.exercise_id])
    .rows[0];
  return {
    exerciseId: we.exercise_id,
    targetSets: sets.length,
    targetRepsMin: Math.min(...reps),
    targetRepsMax: Math.max(...reps),
    targetRestSeconds: restRow?.default_rest_seconds ?? 90,
  };
}

/**
 * Create a new routine copied from a finished session: one routine_exercise
 * per workout_exercise (ordered by sort_order), with targets derived from the
 * session's completed sets. The finish screen "Save As New" path (PRD story 26).
 * Returns the new routine row.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {number} sessionId
 * @param {string} name
 * @param {number|null} folderId
 */
export function saveSessionAsNewRoutine(db, sessionId, name, folderId) {
  const trimmed = (name ?? '').toString().trim();
  if (!trimmed) throw new Error('routineQueries.saveSessionAsNewRoutine: name is required');
  let routine;
  db.transaction(() => {
    const { rows } = db.execute(
      `INSERT INTO routine (folder_id, name) VALUES (?, ?) RETURNING *`,
      [folderId ?? null, trimmed],
    );
    routine = rows[0];
    const wes = db
      .execute(
        `SELECT * FROM workout_exercise WHERE session_id = ? ORDER BY sort_order`,
        [sessionId],
      )
      .rows;
    wes.forEach((we, i) => {
      const targets = deriveTargetsFromWorkoutExercise(db, we);
      // Skip workout_exercises with no completed sets (nothing to template).
      if (!targets) return;
      db.execute(
        `INSERT INTO routine_exercise
           (routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max, target_rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          routine.id,
          targets.exerciseId,
          i,
          targets.targetSets,
          targets.targetRepsMin,
          targets.targetRepsMax,
          targets.targetRestSeconds,
        ],
      );
    });
  });
  return routine;
}

/**
 * Update an existing routine so its routine_exercise rows match today's
 * session: update targets for exercises that were performed, preserve
 * original targets for exercises that were skipped (no completed sets or
 * not in the session at all), and add new rows for exercises added ad-hoc
 * (the finish screen "Update template" path, PRD story 26). Returns the
 * updated routine detail.
 */
export function updateRoutineFromSession(db, routineId, sessionId) {
  db.transaction(() => {
    // Preserve existing routine_exercise rows for exercises that weren't
    // performed (no completed sets). Only update rows for exercises that
    // WERE performed; add new rows for exercises added ad-hoc.
    const existing = db
      .execute(`SELECT * FROM routine_exercise WHERE routine_id = ? ORDER BY sort_order`, [routineId])
      .rows;

    const wes = db
      .execute(`SELECT * FROM workout_exercise WHERE session_id = ? ORDER BY sort_order`, [sessionId])
      .rows;

    const handledReIds = new Set();
    let nextOrder = 0;

    for (const we of wes) {
      const targets = deriveTargetsFromWorkoutExercise(db, we);
      if (we.substituted_from_routine_exercise_id != null) {
        const reId = we.substituted_from_routine_exercise_id;
        handledReIds.add(reId);
        if (targets) {
          // Performed: update targets (exercise_id may differ if substituted).
          db.execute(
            `UPDATE routine_exercise
               SET exercise_id = ?, sort_order = ?, target_sets = ?, target_reps_min = ?, target_reps_max = ?, target_rest_seconds = ?
             WHERE id = ?`,
            [targets.exerciseId, nextOrder, targets.targetSets, targets.targetRepsMin, targets.targetRepsMax, targets.targetRestSeconds, reId],
          );
        } else {
          // Not performed: keep original targets, just update sort_order.
          db.execute(`UPDATE routine_exercise SET sort_order = ? WHERE id = ?`, [nextOrder, reId]);
        }
      } else {
        // No origin link: match to an existing routine_exercise by exercise_id
        // (handles free-flow sessions or test setups without origin links).
        const match = existing.find((re) => re.exercise_id === we.exercise_id && !handledReIds.has(re.id));
        if (match) {
          handledReIds.add(match.id);
          if (targets) {
            db.execute(
              `UPDATE routine_exercise
                 SET sort_order = ?, target_sets = ?, target_reps_min = ?, target_reps_max = ?, target_rest_seconds = ?
               WHERE id = ?`,
              [nextOrder, targets.targetSets, targets.targetRepsMin, targets.targetRepsMax, targets.targetRestSeconds, match.id],
            );
          } else {
            db.execute(`UPDATE routine_exercise SET sort_order = ? WHERE id = ?`, [nextOrder, match.id]);
          }
        } else if (targets) {
          // Truly new exercise not in the routine: insert new.
          db.execute(
            `INSERT INTO routine_exercise
               (routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max, target_rest_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [routineId, targets.exerciseId, nextOrder, targets.targetSets, targets.targetRepsMin, targets.targetRepsMax, targets.targetRestSeconds],
          );
        }
      }
      nextOrder++;
    }

    // Preserve routine_exercises with no corresponding workout_exercise at all.
    for (const re of existing) {
      if (!handledReIds.has(re.id)) {
        db.execute(`UPDATE routine_exercise SET sort_order = ? WHERE id = ?`, [nextOrder, re.id]);
        nextOrder++;
      }
    }

    db.execute(
      `UPDATE routine SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      [routineId],
    );
  });
  return getRoutineDetail(db, routineId);
}