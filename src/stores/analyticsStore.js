// analyticsStore — cached analytics data for Progress and History tabs.
//
// Wraps analyticsQueries behind a narrow interface so screens never call
// getDatabase() or query functions directly. Data is cached in-memory and
// refreshed on demand (e.g. after a session finishes). The store is the
// test surface — tests exercise the 3-method interface, not React components.
//
// Interface:
//   loadProgressData()  → { allTimePRs, recentPRs, volumeData, heatmapData, muscleFreq }
//   loadCalendarData(range?) → { calendarData }
//   refresh()           → void (invalidates cache, called after session finish)

import { create } from 'zustand';

import { getDatabase } from '../utils/db.js';
import {
  getAllTime1RMs,
  getRecent1RMs,
  getWeeklyVolumeByMuscleGroup,
  getHeatmapData,
  getMuscleGroupFrequency,
  getCalendarData,
} from '../db/queries/analyticsQueries.js';

/**
 * @typedef {Object} AnalyticsState
 * @property {Array} allTimePRs
 * @property {Array} recentPRs
 * @property {Array} volumeData
 * @property {Array} heatmapData
 * @property {Array} muscleFreq
 * @property {Array} calendarData
 * @property {boolean} isLoading
 * @property {string|null} error
 */

export const useAnalyticsStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  allTimePRs: [],
  recentPRs: [],
  volumeData: [],
  heatmapData: [],
  muscleFreq: [],
  calendarData: [],
  isLoading: false,
  error: null,

  // -- actions --------------------------------------------------------------

  /** Load all progress-tab data in one call. Returns the data bundle. */
  loadProgressData: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = getDatabase();
      const [allTimePRs, recentPRs, volumeData, heatmapData, muscleFreq] = await Promise.all([
        Promise.resolve(getAllTime1RMs(db)),
        Promise.resolve(getRecent1RMs(db, { daysBack: 30 })),
        Promise.resolve(getWeeklyVolumeByMuscleGroup(db, { weeks: 12 })),
        Promise.resolve(getHeatmapData(db, { days: 365 })),
        Promise.resolve(getMuscleGroupFrequency(db, { daysBack: 90 })),
      ]);
      set({ allTimePRs, recentPRs, volumeData, heatmapData, muscleFreq, isLoading: false });
      return { allTimePRs, recentPRs, volumeData, heatmapData, muscleFreq };
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  /** Load calendar data for a date range. Defaults to the current month. */
  loadCalendarData: async ({ startDate, endDate } = {}) => {
    set({ isLoading: true, error: null });
    try {
      const db = getDatabase();
      const calendarData = getCalendarData(db, { startDate, endDate });
      set({ calendarData, isLoading: false });
      return calendarData;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  /** Invalidate the cache so the next load fetches fresh data. */
  refresh: () => {
    set({
      allTimePRs: [],
      recentPRs: [],
      volumeData: [],
      heatmapData: [],
      muscleFreq: [],
      calendarData: [],
    });
  },
}));
