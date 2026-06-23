import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { initDatabase, resetDatabaseForTesting, getDatabase } from '../../utils/db.js';
import { seedExercises } from '../../db/seed/seed.js';
import { useAnalyticsStore } from '../analyticsStore.js';
import { searchExercises } from '../../db/queries/exerciseQueries.js';

// ---- helpers --------------------------------------------------------------

function findExercise(db, name) {
  const results = searchExercises(db, { query: name, includeArchived: true });
  return results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

/** Seed a completed session with sets so analytics have data to query. */
function logCompletedSession(db, exerciseId, sets) {
  db.transaction(() => {
    const s = db.execute(
      `INSERT INTO workout_session (started_at, finished_at, is_completed) VALUES (?, ?, 1) RETURNING id`,
      ['2025-06-01T10:00:00.000Z', '2025-06-01T11:00:00.000Z'],
    );
    const sessionId = s.rows[0].id;
    const we = db.execute(
      `INSERT INTO workout_exercise (session_id, exercise_id) VALUES (?, ?) RETURNING id`,
      [sessionId, exerciseId],
    );
    const workoutExerciseId = we.rows[0].id;
    db.executeBatch(
      sets.map((set, i) => ({
        sql: `INSERT INTO exercise_set
          (workout_exercise_id, sort_order, weight, reps, set_type, is_completed)
          VALUES (?, ?, ?, ?, ?, ?)`,
        params: [workoutExerciseId, i, set.weight, set.reps, set.set_type ?? 'normal', 1],
      })),
    );
  });
}

const INITIAL_STATE = {
  allTimePRs: [],
  recentPRs: [],
  volumeData: [],
  heatmapData: [],
  muscleFreq: [],
  calendarData: [],
  isLoading: false,
  error: null,
};

function resetStore() {
  useAnalyticsStore.setState(INITIAL_STATE);
}

// ---- tests ----------------------------------------------------------------

let db;
beforeEach(() => {
  resetDatabaseForTesting();
  db = initDatabase({ name: ':memory:' });
  seedExercises(db);
  resetStore();
});
afterEach(() => {
  resetDatabaseForTesting();
});

describe('analyticsStore — loadProgressData', () => {
  it('loads all progress data in one call', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logCompletedSession(db, bench.id, [
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
    ]);

    const data = await useAnalyticsStore.getState().loadProgressData();
    expect(data.allTimePRs).toBeDefined();
    expect(data.recentPRs).toBeDefined();
    expect(data.volumeData).toBeDefined();
    expect(data.heatmapData).toBeDefined();
    expect(data.muscleFreq).toBeDefined();

    const state = useAnalyticsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('computes estimated 1RM for completed sets', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    // 100kg × 5 reps → Brzycki: 100 × 36/(37-5) = 100 × 36/32 = 112.5
    logCompletedSession(db, bench.id, [{ weight: 100, reps: 5 }]);

    await useAnalyticsStore.getState().loadProgressData();
    const state = useAnalyticsStore.getState();
    expect(state.allTimePRs.length).toBeGreaterThan(0);
    const pr = state.allTimePRs.find((p) => p.exerciseId === bench.id);
    expect(pr).toBeDefined();
    expect(pr.estimated1RM).toBeCloseTo(112.5, 0);
  });

  it('returns empty arrays when no sessions exist', async () => {
    const data = await useAnalyticsStore.getState().loadProgressData();
    expect(data.allTimePRs).toEqual([]);
    expect(data.recentPRs).toEqual([]);
    expect(data.volumeData).toEqual([]);
    expect(data.heatmapData).toEqual([]);
    expect(data.muscleFreq).toEqual([]);
  });
});

describe('analyticsStore — loadCalendarData', () => {
  it('loads calendar data for a date range', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logCompletedSession(db, bench.id, [{ weight: 80, reps: 8 }]);

    const data = await useAnalyticsStore.getState().loadCalendarData({
      startDate: '2025-06-01',
      endDate: '2025-06-30',
    });
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].date).toBe('2025-06-01');

    const state = useAnalyticsStore.getState();
    expect(state.calendarData).toEqual(data);
  });

  it('returns empty array when no sessions in range', async () => {
    const data = await useAnalyticsStore.getState().loadCalendarData({
      startDate: '2020-01-01',
      endDate: '2020-01-31',
    });
    expect(data).toEqual([]);
  });
});

describe('analyticsStore — refresh', () => {
  it('clears all cached data', async () => {
    const bench = findExercise(db, 'Barbell Bench Press');
    logCompletedSession(db, bench.id, [{ weight: 80, reps: 8 }]);
    await useAnalyticsStore.getState().loadProgressData();
    await useAnalyticsStore.getState().loadCalendarData({
      startDate: '2025-06-01',
      endDate: '2025-06-30',
    });

    useAnalyticsStore.getState().refresh();
    const state = useAnalyticsStore.getState();
    expect(state.allTimePRs).toEqual([]);
    expect(state.recentPRs).toEqual([]);
    expect(state.volumeData).toEqual([]);
    expect(state.heatmapData).toEqual([]);
    expect(state.muscleFreq).toEqual([]);
    expect(state.calendarData).toEqual([]);
  });
});
