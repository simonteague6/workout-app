// analyticsQueries — analytics and history queries for the Progress and History
// tabs (issue #6).
//
// Every function takes the db adapter as its first argument so the SAME code
// runs on-device (op-sqlite) and in Jest (node:sqlite in-memory).
//
// Conventions:
//   * All timestamps are ISO-8601 TEXT (UTC).
//   * Warm-up sets (set_type = 'warmup') are excluded from volume/stats.
//   * Only completed sessions (is_completed = 1) are included in analytics.

import { getSessionDetail as _getSessionDetail } from './sessionQueries.js';
import { getExerciseHistory as _getExerciseHistory } from './exerciseQueries.js';

// Re-export existing query functions so callers can import everything from
// analyticsQueries without needing to know the source module.
export const getSessionDetail = _getSessionDetail;
export const getExerciseHistory = _getExerciseHistory;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/**
 * Sessions grouped by date. Only completed sessions are included.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ startDate?: string, endDate?: string }} [options]
 * @returns {{ date: string, sessionCount: number, exerciseCount: number, durationSeconds: number }[]}
 */
export function getCalendarData(db, { startDate, endDate } = {}) {
  let where = 'WHERE ws.is_completed = 1';
  const params = [];

  if (startDate) {
    where += ' AND ws.started_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND ws.started_at < ?';
    // Include the full end date by adding a day
    params.push(endDate.slice(0, 10) + 'T23:59:59.999Z');
  }

  const { rows } = db.execute(
    `SELECT substr(ws.started_at, 1, 10) AS date,
            COUNT(DISTINCT ws.id) AS sessionCount,
            COUNT(DISTINCT we.id) AS exerciseCount,
            COALESCE(SUM(
              CAST((julianday(ws.finished_at) - julianday(ws.started_at)) * 86400 AS INTEGER)
            ), 0) AS durationSeconds
       FROM workout_session ws
       LEFT JOIN workout_exercise we ON we.session_id = ws.id
      ${where}
      GROUP BY substr(ws.started_at, 1, 10)
      ORDER BY date ASC`,
    params,
  );

  return rows.map((r) => ({
    date: r.date,
    sessionCount: r.sessionCount,
    exerciseCount: r.exerciseCount,
    durationSeconds: r.durationSeconds,
  }));
}

// ---------------------------------------------------------------------------
// 1RM estimation (Brzycki formula)
// ---------------------------------------------------------------------------

/**
 * Brzycki estimated 1RM: weight × (36 / (37 - reps)) for reps < 37,
 * otherwise just weight.
 */
function brzycki1RM(weight, reps) {
  if (reps >= 37) return weight;
  return weight * (36 / (37 - reps));
}

/**
 * All-time max estimated 1RM per exercise, calculated from completed
 * non-warmup sets using the Brzycki formula.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @returns {{ exerciseId: number, exerciseName: string, estimated1RM: number, date: string }[]}
 */
export function getAllTime1RMs(db) {
  const { rows } = db.execute(
    `SELECT e.id AS exerciseId,
            e.name AS exerciseName,
            es.weight,
            es.reps,
            ws.started_at AS date
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
       JOIN exercise e ON e.id = we.exercise_id
       JOIN workout_session ws ON ws.id = we.session_id
      WHERE ws.is_completed = 1
        AND es.is_completed = 1
        AND es.set_type != 'warmup'
        AND es.weight IS NOT NULL
        AND es.reps IS NOT NULL
      ORDER BY ws.started_at DESC`,
  );

  // Compute 1RM per row, then take max per exercise
  const byExercise = new Map();
  for (const r of rows) {
    const rm = brzycki1RM(r.weight, r.reps);
    const existing = byExercise.get(r.exerciseId);
    if (!existing || rm > existing.estimated1RM) {
      byExercise.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        estimated1RM: rm,
        date: r.date,
      });
    }
  }

  return [...byExercise.values()].sort((a, b) => b.estimated1RM - a.estimated1RM);
}

/**
 * Exercises where the estimated 1RM was achieved in the last N days.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ daysBack?: number, referenceDate?: string }} [options]
 * @returns {{ exerciseId: number, exerciseName: string, estimated1RM: number, date: string }[]}
 */
export function getRecent1RMs(db, { daysBack = 30, referenceDate } = {}) {
  const refDate = referenceDate || new Date().toISOString();

  const { rows } = db.execute(
    `SELECT e.id AS exerciseId,
            e.name AS exerciseName,
            es.weight,
            es.reps,
            ws.started_at AS date
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
       JOIN exercise e ON e.id = we.exercise_id
       JOIN workout_session ws ON ws.id = we.session_id
      WHERE ws.is_completed = 1
        AND es.is_completed = 1
        AND es.set_type != 'warmup'
        AND es.weight IS NOT NULL
        AND es.reps IS NOT NULL
        AND ws.started_at >= datetime(?, '-' || ? || ' days')
      ORDER BY ws.started_at DESC`,
    [refDate, String(daysBack)],
  );

  // Compute 1RM per row, take max per exercise
  const byExercise = new Map();
  for (const r of rows) {
    const rm = brzycki1RM(r.weight, r.reps);
    const existing = byExercise.get(r.exerciseId);
    if (!existing || rm > existing.estimated1RM) {
      byExercise.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        estimated1RM: rm,
        date: r.date,
      });
    }
  }

  return [...byExercise.values()].sort((a, b) => b.estimated1RM - a.estimated1RM);
}

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

/**
 * Weekly total volume (sum of weight × reps) per muscle group, for completed
 * non-warmup sets.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ weeks?: number }} [options]
 * @returns {{ muscleGroup: string, weekStart: string, totalVolume: number }[]}
 */
/**
 * Weekly total volume (sum of weight × reps) per muscle group, for completed
 * non-warmup sets.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ weeks?: number, referenceDate?: string }} [options]
 * @returns {{ muscleGroup: string, weekStart: string, totalVolume: number }[]}
 */
export function getWeeklyVolumeByMuscleGroup(db, { weeks = 12, referenceDate } = {}) {
  const refDate = referenceDate || new Date().toISOString();
  const { rows } = db.execute(
    `SELECT mg.name AS muscleGroup,
            date(ws.started_at, 'weekday 1', '-7 days') AS weekStart,
            SUM(es.weight * es.reps) AS totalVolume
       FROM exercise_set es
       JOIN workout_exercise we ON we.id = es.workout_exercise_id
       JOIN exercise e ON e.id = we.exercise_id
       JOIN muscle_group mg ON mg.id = e.primary_muscle_group_id
       JOIN workout_session ws ON ws.id = we.session_id
      WHERE ws.is_completed = 1
        AND es.is_completed = 1
        AND es.set_type != 'warmup'
        AND es.weight IS NOT NULL
        AND es.reps IS NOT NULL
        AND ws.started_at >= datetime(?, '-' || ? || ' days', 'weekday 1', '-7 days')
      GROUP BY mg.name, weekStart
      ORDER BY weekStart ASC, mg.name ASC`,
    [refDate, String(weeks * 7)],
  );

  return rows.map((r) => ({
    muscleGroup: r.muscleGroup,
    weekStart: r.weekStart,
    totalVolume: r.totalVolume,
  }));
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

/**
 * Workout count per day for a calendar heatmap.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ days?: number }} [options]
 * @returns {{ date: string, count: number }[]}
 */
export function getHeatmapData(db, { days = 365, referenceDate } = {}) {
  const refDate = referenceDate || new Date().toISOString();
  const { rows } = db.execute(
    `SELECT substr(ws.started_at, 1, 10) AS date,
            COUNT(*) AS count
       FROM workout_session ws
      WHERE ws.is_completed = 1
        AND ws.started_at >= datetime(?, '-' || ? || ' days')
      GROUP BY substr(ws.started_at, 1, 10)
      ORDER BY date ASC`,
    [refDate, String(days)],
  );

  return rows.map((r) => ({
    date: r.date,
    count: r.count,
  }));
}

// ---------------------------------------------------------------------------
// Muscle group frequency
// ---------------------------------------------------------------------------

/**
 * Session count per muscle group over a time period. Counts sessions where
 * the muscle group appears as primary or secondary.
 * @param {import('../../utils/db.js').DbAdapter} db
 * @param {{ daysBack?: number }} [options]
 * @returns {{ muscleGroup: string, sessionCount: number }[]}
 */
export function getMuscleGroupFrequency(db, { daysBack = 90, referenceDate } = {}) {
  const refDate = referenceDate || new Date().toISOString();
  const { rows } = db.execute(
    `SELECT mg.name AS muscleGroup,
            COUNT(DISTINCT ws.id) AS sessionCount
       FROM workout_session ws
       JOIN workout_exercise we ON we.session_id = ws.id
       JOIN exercise e ON e.id = we.exercise_id
       JOIN muscle_group mg ON mg.id IN (e.primary_muscle_group_id, e.secondary_muscle_group_id)
      WHERE ws.is_completed = 1
        AND ws.started_at >= datetime(?, '-' || ? || ' days')
      GROUP BY mg.name
      ORDER BY sessionCount DESC`,
    [refDate, String(daysBack)],
  );

  return rows.map((r) => ({
    muscleGroup: r.muscleGroup,
    sessionCount: r.sessionCount,
  }));
}
