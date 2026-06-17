// settingsStore — theme, units, AI provider keys, and app defaults.
//
// Empty shell for the scaffold (issue #1). Persistence (persisted to a
// settings table / AsyncStorage) and the AI provider configuration UI are
// wired in issue #7. The unit-conversion and rest-timer-resolution helpers
// are exercised in issue #7 tests.

import { create } from 'zustand';

export const UNITS = Object.freeze({ LBS: 'lbs', KG: 'kg' });
export const THEME = Object.freeze({ LIGHT: 'light', DARK: 'dark', SYSTEM: 'system' });

/**
 * @typedef {Object} SettingsStoreState
 * @property {'lbs'|'kg'} unit
 * @property {'light'|'dark'|'system'} theme
 * @property {number} defaultRestSeconds  app-wide default rest timer (2 min per PRD)
 * @property {number} defaultIncrement    app-wide default weight increment (lbs/kg)
 * @property {{provider?: string, apiKey?: string, model?: string, endpoint?: string}} ai
 */

export const useSettingsStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  unit: UNITS.LBS,
  theme: THEME.SYSTEM,
  defaultRestSeconds: 120,
  defaultIncrement: 2.5,
  ai: { provider: null, apiKey: null, model: null, endpoint: null },

  // -- actions --------------------------------------------------------------
  // Pure state setters that need no DB; safe to use immediately. Full
  // persistence (load/save) is wired in issue #7.
  setUnit: (unit) => {
    if (!Object.values(UNITS).includes(unit)) {
      throw new Error(`settingsStore.setUnit: invalid unit "${unit}"`);
    }
    set({ unit });
  },
  setTheme: (theme) => {
    if (!Object.values(THEME).includes(theme)) {
      throw new Error(`settingsStore.setTheme: invalid theme "${theme}"`);
    }
    set({ theme });
  },
  setDefaultRestSeconds: (seconds) => set({ defaultRestSeconds: seconds }),
  setDefaultIncrement: (increment) => set({ defaultIncrement: increment }),

  // AI provider configuration (implemented in issue #7 with persistence).
  setAiConfig: async (_config) => {
    throw new Error('settingsStore.setAiConfig: not implemented (issue #7)');
  },
  loadSettings: async () => {
    throw new Error('settingsStore.loadSettings: not implemented (issue #7)');
  },
}));