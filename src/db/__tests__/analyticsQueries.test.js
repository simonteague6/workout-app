import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises } from '../seed/seed.js';
import {
  getCalendarData,
  getSessionDetail,
  getExerciseHistory,
  getAllTime1RMs,
  getRecent1RMs,
  getWeeklyVolumeByMuscleGroup,
  getHeatmapData,
  getMuscleGroupFrequency,
} from '../queries/analyticsQueries.js';
import { searchExercises } from '../queries/exerciseQueries.js';

// ---- helpers --------------------------------------------------------------

function findExercise(db, name) {
  const results = searchExercises(db, { query: name, includeArchived: true });
  return results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

/**
 * Create a completed session with multiple exercises and sets.
 * Returns the session id.
 */
function createCompletedSession(db, exercisesWithSets, { startedAt, finishedAt } = {}) {
  const start = startedAt ?? '2025-01-15T10:00:00.000Z';
  const finish = finishedAt ?? '2025-01-15T11:00:00.000Z';

  const s = db.execute(
    `INSERT INTO workout_session (started_at, finished_at, is_completed) VALUES (?, ?, 1) RETURNING id`,
    [start, finish],
  );
  const sessionId = s.rows[0].id;

  exercisesWithSets.forEach(({ exerciseId, sets }, exIdx) => {
    const we = db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id, sort_order) VALUES (?, ?, ?) RETURNING id`,
      [sessionId, exerciseId, exIdx],
    );
    const workoutExerciseId = we.rows[0].id;

    if (sets && sets.length) {
      db.executeBatch(
        sets.map((set, i) => ({
          sql: `INSERT INTO exercise_set
            (workout_exercise_id, sort_order, weight, reps, set_type, is_completed)
            VALUES (?, ?, ?, ?, ?, ?)`,
          params: [
            workoutExerciseId,
            i,
            set.weight ?? null,
            set.reps ?? null,
            set.set_type ?? 'normal',
            set.is_completed ?? 1,
          ],
        })),
      );
    }
  });

  return sessionId;
}

let db;
let benchPress;
let squat;
let deadlift;

beforeEach(() => {
  db = createInMemoryDb();
  seedExercises(db);

  benchPress = findExercise(db, 'Barbell Bench Press');
  squat = findExercise(db, 'Barbell Squat');
  deadlift = findExercise(db, 'Barbell Deadlift');
});

afterEach(() => {
  db.close();
});

// ---- tests ----------------------------------------------------------------

describe('analyticsQueries — getCalendarData', () => {
  it('returns sessions grouped by date with counts and duration', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5 }, { weight: 80, reps: 5 }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: squat.id, sets: [{ weight: 100, reps: 5 }] },
    ], { startedAt: '2025-01-15T14:00:00.000Z', finishedAt: '2025-01-15T14:45:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: deadlift.id, sets: [{ weight: 140, reps: 3 }] },
    ], { startedAt: '2025-01-16T09:00:00.000Z', finishedAt: '2025-01-16T09:20:00.000Z' });

    const data = getCalendarData(db, { startDate: '2025-01-01', endDate: '2025-01-31' });

    expect(data).toHaveLength(2);

    const day1 = data.find((d) => d.date === '2025-01-15');
    expect(day1).toBeDefined();
    expect(day1.exerciseCount).toBe(2);
    expect(day1.durationSeconds).toBe(4500); // 30min + 45min

    const day2 = data.find((d) => d.date === '2025-01-16');
    expect(day2).toBeDefined();
    expect(day2.sessionCount).toBe(1);
    expect(day2.exerciseCount).toBe(1);
    expect(day2.durationSeconds).toBe(1200); // 20min
  });

  it('excludes incomplete sessions', () => {
    // Completed session
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5 }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    // Incomplete session (is_completed = 0)
    const s = db.execute(
      `INSERT INTO workout_session (started_at, is_completed) VALUES (?, 0) RETURNING id`,
      ['2025-01-16T10:00:00.000Z'],
    );
    const sessionId = s.rows[0].id;
    db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id, sort_order) VALUES (?, ?, 0)`,
      [sessionId, squat.id],
    );

    const data = getCalendarData(db, { startDate: '2025-01-01', endDate: '2025-01-31' });
    expect(data).toHaveLength(1);
    expect(data[0].date).toBe('2025-01-15');
  });

  it('returns empty array when no sessions exist', () => {
    const data = getCalendarData(db, { startDate: '2025-01-01', endDate: '2025-01-31' });
    expect(data).toEqual([]);
  });
});

describe('analyticsQueries — getSessionDetail', () => {
  it('returns full nested session shape', () => {
    const sessionId = createCompletedSession(db, [
      {
        exerciseId: benchPress.id,
        sets: [
          { weight: 80, reps: 5, set_type: 'normal' },
          { weight: 80, reps: 5, set_type: 'normal' },
          { weight: 60, reps: 10, set_type: 'warmup' },
        ],
      },
      {
        exerciseId: squat.id,
        sets: [
          { weight: 100, reps: 5 },
        ],
      },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T11:00:00.000Z' });

    const detail = getSessionDetail(db, sessionId);

    expect(detail).not.toBeNull();
    expect(detail.id).toBe(sessionId);
    expect(detail.is_completed).toBe(1);
    expect(detail.exercises).toHaveLength(2);

    const firstEx = detail.exercises[0];
    expect(firstEx.exercise.name).toBe(benchPress.name);
    expect(firstEx.sets).toHaveLength(3);
    expect(firstEx.sets[0].weight).toBe(80);
    expect(firstEx.sets[0].reps).toBe(5);
    expect(firstEx.sets[0].set_type).toBe('normal');

    const secondEx = detail.exercises[1];
    expect(secondEx.exercise.name).toBe(squat.name);
    expect(secondEx.sets).toHaveLength(1);
  });

  it('returns null for non-existent session', () => {
    const detail = getSessionDetail(db, 99999);
    expect(detail).toBeNull();
  });
});

describe('analyticsQueries — getExerciseHistory', () => {
  it('returns all sessions for an exercise chronologically with sets', () => {
    // Session 1 (older)
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 70, reps: 5 }, { weight: 75, reps: 5 }] },
    ], { startedAt: '2025-01-10T10:00:00.000Z', finishedAt: '2025-01-10T10:30:00.000Z' });

    // Session 2 (newer)
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5 }, { weight: 80, reps: 4 }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    const history = getExerciseHistory(db, benchPress.id);

    expect(history).toHaveLength(2);
    // Newest first
    expect(history[0].started_at).toBe('2025-01-15T10:00:00.000Z');
    expect(history[1].started_at).toBe('2025-01-10T10:00:00.000Z');

    // Check sets in the newest session
    expect(history[0].sets).toHaveLength(2);
    expect(history[0].sets[0].weight).toBe(80);
    expect(history[0].sets[0].reps).toBe(5);
    expect(history[0].sets[1].weight).toBe(80);
    expect(history[0].sets[1].reps).toBe(4);
  });

  it('returns empty array when exercise has no history', () => {
    const history = getExerciseHistory(db, benchPress.id);
    expect(history).toEqual([]);
  });
});

describe('analyticsQueries — getAllTime1RMs', () => {
  it('calculates Brzycki 1RM correctly', () => {
    // 100kg × 5 reps → 100 × 36/32 = 112.5
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 100, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    const rms = getAllTime1RMs(db);

    expect(rms).toHaveLength(1);
    expect(rms[0].exerciseId).toBe(benchPress.id);
    expect(rms[0].exerciseName).toBe(benchPress.name);
    expect(rms[0].estimated1RM).toBeCloseTo(112.5, 1);
  });

  it('takes the max 1RM across all sessions', () => {
    // Session 1: 100×5 → 112.5
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 100, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-10T10:00:00.000Z', finishedAt: '2025-01-10T10:30:00.000Z' });

    // Session 2: 110×3 → 110 × 36/34 = 116.47
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 110, reps: 3, set_type: 'normal' }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    const rms = getAllTime1RMs(db);

    expect(rms).toHaveLength(1);
    expect(rms[0].estimated1RM).toBeCloseTo(116.47, 1);
  });

  it('excludes warmup sets from 1RM calculation', () => {
    createCompletedSession(db, [
      {
        exerciseId: benchPress.id,
        sets: [
          { weight: 60, reps: 10, set_type: 'warmup' },
          { weight: 100, reps: 5, set_type: 'normal' },
        ],
      },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    const rms = getAllTime1RMs(db);

    expect(rms).toHaveLength(1);
    // Should be based on 100×5, not 60×10
    expect(rms[0].estimated1RM).toBeCloseTo(112.5, 1);
  });

  it('returns multiple exercises with their PRs', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 100, reps: 5, set_type: 'normal' }] },
      { exerciseId: squat.id, sets: [{ weight: 140, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T11:00:00.000Z' });

    const rms = getAllTime1RMs(db);

    expect(rms).toHaveLength(2);
    const bench = rms.find((r) => r.exerciseId === benchPress.id);
    const squatRM = rms.find((r) => r.exerciseId === squat.id);
    expect(bench.estimated1RM).toBeCloseTo(112.5, 1);
    expect(squatRM.estimated1RM).toBeCloseTo(157.5, 1); // 140 × 36/32
  });

  it('handles reps >= 37 by using weight directly', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 50, reps: 40, set_type: 'normal' }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    const rms = getAllTime1RMs(db);
    expect(rms[0].estimated1RM).toBe(50);
  });

  it('returns empty array when no completed sets exist', () => {
    const rms = getAllTime1RMs(db);
    expect(rms).toEqual([]);
  });
});

describe('analyticsQueries — getRecent1RMs', () => {
  it('returns exercises with PRs in the last N days', () => {
    // Old session (outside 30 days)
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 100, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-10T10:00:00.000Z', finishedAt: '2025-01-10T10:30:00.000Z' });

    // Recent session with higher 1RM
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 110, reps: 3, set_type: 'normal' }] },
    ], { startedAt: '2025-01-25T10:00:00.000Z', finishedAt: '2025-01-25T10:30:00.000Z' });

    // Recent session for squat (new exercise, all sets are recent)
    createCompletedSession(db, [
      { exerciseId: squat.id, sets: [{ weight: 120, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-28T10:00:00.000Z', finishedAt: '2025-01-28T10:30:00.000Z' });

    // Query with daysBack=30 from 2025-02-01
    const recent = getRecent1RMs(db, { daysBack: 30, referenceDate: '2025-02-01T00:00:00.000Z' });

    // Bench press has a PR in the last 30 days (Jan 25)
    // Squat has a PR in the last 30 days (Jan 28)
    expect(recent).toHaveLength(2);
  });

  it('returns empty array when no recent PRs', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 100, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-10T10:00:00.000Z', finishedAt: '2025-01-10T10:30:00.000Z' });

    const recent = getRecent1RMs(db, { daysBack: 7, referenceDate: '2025-01-20T00:00:00.000Z' });
    expect(recent).toEqual([]);
  });
});

describe('analyticsQueries — getWeeklyVolumeByMuscleGroup', () => {
  it('returns weekly volume per muscle group excluding warmup sets', () => {
    createCompletedSession(db, [
      {
        exerciseId: benchPress.id,
        sets: [
          { weight: 60, reps: 10, set_type: 'warmup' }, // excluded
          { weight: 80, reps: 5, set_type: 'normal' },  // 400
          { weight: 80, reps: 5, set_type: 'normal' },  // 400
        ],
      },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    const volume = getWeeklyVolumeByMuscleGroup(db, { weeks: 12, referenceDate: '2025-02-01T00:00:00.000Z' });

    // Bench press primary muscle group should have volume = 800
    expect(volume.length).toBeGreaterThan(0);
    const benchVolume = volume.find((v) => v.muscleGroup === benchPress.primary_muscle);
    expect(benchVolume).toBeDefined();
    expect(benchVolume.totalVolume).toBe(800);
  });

  it('aggregates volume across multiple sessions in the same week', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5, set_type: 'normal' }] },
    ], { startedAt: '2025-01-17T10:00:00.000Z', finishedAt: '2025-01-17T10:30:00.000Z' });

    const volume = getWeeklyVolumeByMuscleGroup(db, { weeks: 12, referenceDate: '2025-02-01T00:00:00.000Z' });

    const benchVolume = volume.find((v) => v.muscleGroup === benchPress.primary_muscle);
    expect(benchVolume).toBeDefined();
    expect(benchVolume.totalVolume).toBe(800); // 400 + 400
  });
});

describe('analyticsQueries — getHeatmapData', () => {
  it('returns workout count per day', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5 }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: squat.id, sets: [{ weight: 100, reps: 5 }] },
    ], { startedAt: '2025-01-15T14:00:00.000Z', finishedAt: '2025-01-15T14:30:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: deadlift.id, sets: [{ weight: 140, reps: 3 }] },
    ], { startedAt: '2025-01-16T09:00:00.000Z', finishedAt: '2025-01-16T09:20:00.000Z' });

    const heatmap = getHeatmapData(db, { days: 365, referenceDate: '2025-02-01T00:00:00.000Z' });

    expect(heatmap.length).toBeGreaterThanOrEqual(2);

    const day1 = heatmap.find((d) => d.date === '2025-01-15');
    expect(day1).toBeDefined();
    expect(day1.count).toBe(2);

    const day2 = heatmap.find((d) => d.date === '2025-01-16');
    expect(day2).toBeDefined();
    expect(day2.count).toBe(1);
  });

  it('returns empty array when no sessions', () => {
    const heatmap = getHeatmapData(db, { days: 365, referenceDate: '2025-02-01T00:00:00.000Z' });
    expect(heatmap).toEqual([]);
  });
});

describe('analyticsQueries — getMuscleGroupFrequency', () => {
  it('returns session count per muscle group', () => {
    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5 }] },
    ], { startedAt: '2025-01-15T10:00:00.000Z', finishedAt: '2025-01-15T10:30:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: benchPress.id, sets: [{ weight: 80, reps: 5 }] },
    ], { startedAt: '2025-01-16T10:00:00.000Z', finishedAt: '2025-01-16T10:30:00.000Z' });

    createCompletedSession(db, [
      { exerciseId: squat.id, sets: [{ weight: 100, reps: 5 }] },
    ], { startedAt: '2025-01-17T10:00:00.000Z', finishedAt: '2025-01-17T10:30:00.000Z' });

    const freq = getMuscleGroupFrequency(db, { daysBack: 90, referenceDate: '2025-02-01T00:00:00.000Z' });

    // Bench press primary muscle group should have 2 sessions
    const benchFreq = freq.find((f) => f.muscleGroup === benchPress.primary_muscle);
    expect(benchFreq).toBeDefined();
    expect(benchFreq.sessionCount).toBe(2);

    // Squat primary muscle group should have 1 session
    const squatFreq = freq.find((f) => f.muscleGroup === squat.primary_muscle);
    expect(squatFreq).toBeDefined();
    expect(squatFreq.sessionCount).toBe(1);
  });

  it('returns empty array when no sessions in range', () => {
    const freq = getMuscleGroupFrequency(db, { daysBack: 1, referenceDate: '2025-02-01T00:00:00.000Z' });
    expect(freq).toEqual([]);
  });
});
