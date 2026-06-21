// settingsStore — theme, units, AI provider config, and app defaults.
//
// Persistence: non-secret settings live in the app_settings SQLite table
// (settingsQueries). The AI API key is a secret and lives in the device
// keystore (secureStorage / expo-secure-store), never in SQLite — so a JSON
// export never leaks credentials. loadSettings() hydrates the store from both
// stores on app bootstrap; every setter writes through immediately so the
// value survives an app restart.
//
// Setters update in-memory state synchronously and best-effort persist: if the
// database is not open yet (pure-JS usage) the state still updates and no
// persistence happens. Once initDatabase() has run, every toggle is durable.

import { create } from 'zustand';

import { getDatabase } from '../utils/db.js';
import { setSetting, getAllSettings } from '../db/queries/settingsQueries.js';
import {
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
  SECURE_KEYS,
} from '../utils/secureStorage.js';

export const UNITS = Object.freeze({ LBS: 'lbs', KG: 'kg' });
export const THEME = Object.freeze({ LIGHT: 'light', DARK: 'dark', SYSTEM: 'system' });
export const SEARCH_BAR_POSITIONS = Object.freeze({ TOP: 'top', BOTTOM: 'bottom' });
export const AI_PROVIDERS = Object.freeze({
  OPENAI: 'openai',
  OPENROUTER: 'openrouter',
  ANTHROPIC: 'anthropic',
  CUSTOM: 'custom',
});

const VALID_UNITS = Object.values(UNITS);
const VALID_THEMES = Object.values(THEME);
const VALID_PROVIDERS = Object.values(AI_PROVIDERS);
const VALID_SEARCH_BAR_POSITIONS = Object.values(SEARCH_BAR_POSITIONS);

/**
 * @typedef {Object} SettingsStoreState
 * @property {'lbs'|'kg'} unit
 * @property {'light'|'dark'|'system'} theme
 * @property {number} defaultRestSeconds  app-wide default rest timer (fallback)
 * @property {number} defaultIncrement    app-wide default weight increment
 * @property {'top'|'bottom'} searchBarPosition
 * @property {{provider?: string|null, apiKey?: string|null, model?: string|null, endpoint?: string|null}} ai
 */

// Returns the shared db adapter, or null when initDatabase() has not run yet
// (pure-JS usage / tests without a DB). Never throws from a setter.
function dbOrNull() {
  try {
    return getDatabase();
  } catch {
    return null;
  }
}

export const useSettingsStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  unit: UNITS.LBS,
  theme: THEME.SYSTEM,
  defaultRestSeconds: 120,
  defaultIncrement: 2.5,
  searchBarPosition: 'top',
  ai: { provider: null, apiKey: null, model: null, endpoint: null },

  // -- actions --------------------------------------------------------------
  setUnit: (unit) => {
    if (!VALID_UNITS.includes(unit)) {
      throw new Error(`settingsStore.setUnit: invalid unit "${unit}"`);
    }
    const db = dbOrNull();
    if (db) setSetting(db, 'unit', unit);
    set({ unit });
  },

  setTheme: (theme) => {
    if (!VALID_THEMES.includes(theme)) {
      throw new Error(`settingsStore.setTheme: invalid theme "${theme}"`);
    }
    const db = dbOrNull();
    if (db) setSetting(db, 'theme', theme);
    set({ theme });
  },

  setDefaultRestSeconds: (seconds) => {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`settingsStore.setDefaultRestSeconds: invalid value "${seconds}"`);
    }
    const db = dbOrNull();
    if (db) setSetting(db, 'defaultRestSeconds', n);
    set({ defaultRestSeconds: n });
  },

  setDefaultIncrement: (increment) => {
    const n = Number(increment);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`settingsStore.setDefaultIncrement: invalid value "${increment}"`);
    }
    const db = dbOrNull();
    if (db) setSetting(db, 'defaultIncrement', n);
    set({ defaultIncrement: n });
  },

  setSearchBarPosition: (position) => {
    if (!VALID_SEARCH_BAR_POSITIONS.includes(position)) {
      throw new Error(`settingsStore.setSearchBarPosition: invalid position "${position}"`);
    }
    const db = dbOrNull();
    if (db) setSetting(db, 'searchBarPosition', position);
    set({ searchBarPosition: position });
  },

  // Partial patch: { provider?, apiKey?, model?, endpoint? }. Persists
  // non-secret fields to app_settings and the API key to the keystore.
  setAiConfig: async (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('settingsStore.setAiConfig: expected a config object');
    }
    if (config.provider !== undefined && config.provider !== null && !VALID_PROVIDERS.includes(config.provider)) {
      throw new Error(`settingsStore.setAiConfig: invalid provider "${config.provider}"`);
    }

    const db = dbOrNull();
    if (db) {
      if (config.provider !== undefined) setSetting(db, 'aiProvider', config.provider ?? '');
      if (config.model !== undefined) setSetting(db, 'aiModel', config.model ?? '');
      if (config.endpoint !== undefined) setSetting(db, 'aiEndpoint', config.endpoint ?? '');
    }
    if (config.apiKey !== undefined) {
      if (config.apiKey) await setSecureItem(SECURE_KEYS.AI_API_KEY, config.apiKey);
      else await deleteSecureItem(SECURE_KEYS.AI_API_KEY);
    }
    set((state) => ({ ai: { ...state.ai, ...config } }));
  },

  // Hydrate from SQLite + keystore. Safe to call once on app startup; a no-op
  // when the database is not open yet (defaults remain).
  loadSettings: async () => {
    const db = dbOrNull();
    if (!db) return;
    const all = getAllSettings(db);
    const apiKey = await getSecureItem(SECURE_KEYS.AI_API_KEY);

    const next = {};
    if (all.theme) next.theme = all.theme;
    if (all.unit) next.unit = all.unit;
    if (all.searchBarPosition) next.searchBarPosition = all.searchBarPosition;
    if (all.defaultRestSeconds != null) next.defaultRestSeconds = Number(all.defaultRestSeconds);
    if (all.defaultIncrement != null) next.defaultIncrement = Number(all.defaultIncrement);
    next.ai = {
      provider: all.aiProvider || null,
      apiKey: apiKey || null,
      model: all.aiModel || null,
      endpoint: all.aiEndpoint || null,
    };
    set(next);
  },
}));
