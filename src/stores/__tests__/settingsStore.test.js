import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  createInMemoryDb,
  initDatabase,
  resetDatabaseForTesting,
  getDatabase,
} from '../../utils/db.js';
import { getSetting } from '../../db/queries/settingsQueries.js';
import {
  getSecureItem,
  setSecureItem,
  resetSecureStorageForTesting,
  SECURE_KEYS,
} from '../../utils/secureStorage.js';
import {
  useSettingsStore,
  UNITS,
  THEME,
  AI_PROVIDERS,
  SEARCH_BAR_POSITIONS,
} from '../settingsStore.js';
// The store persists via the shared singleton db (getDatabase), so each test
// boots a fresh in-memory shared db, resets the keystore, and resets the
// store's in-memory state to the documented defaults.
const DEFAULTS = {
  unit: UNITS.LBS,
  theme: THEME.SYSTEM,
  defaultRestSeconds: 120,
  defaultIncrement: 2.5,
  searchBarPosition: 'top',
};

beforeEach(() => {
  resetDatabaseForTesting();
  initDatabase({ name: ':memory:' });
  resetSecureStorageForTesting();
  useSettingsStore.setState(DEFAULTS);
});

afterEach(() => {
  resetDatabaseForTesting();
});

describe('settingsStore — persistence', () => {
  it('persists unit to app_settings and updates state', () => {
    useSettingsStore.getState().setUnit(UNITS.KG);
    expect(useSettingsStore.getState().unit).toBe(UNITS.KG);
    expect(getSetting(getDatabase(), 'unit')).toBe('kg');
  });

  it('persists theme to app_settings', () => {
    useSettingsStore.getState().setTheme(THEME.DARK);
    expect(useSettingsStore.getState().theme).toBe(THEME.DARK);
    expect(getSetting(getDatabase(), 'theme')).toBe('dark');
  });

  it('persists default rest seconds as a string', () => {
    useSettingsStore.getState().setDefaultRestSeconds(90);
    expect(useSettingsStore.getState().defaultRestSeconds).toBe(90);
    expect(getSetting(getDatabase(), 'defaultRestSeconds')).toBe('90');
  });

  it('persists default increment as a string', () => {
    useSettingsStore.getState().setDefaultIncrement(5);
    expect(useSettingsStore.getState().defaultIncrement).toBe(5);
    expect(getSetting(getDatabase(), 'defaultIncrement')).toBe('5');
  });

  it('rejects an invalid unit', () => {
    expect(() => useSettingsStore.getState().setUnit('stone')).toThrow(/invalid unit/);
  });

  it('rejects an invalid theme', () => {
    expect(() => useSettingsStore.getState().setTheme('hot-pink')).toThrow(/invalid theme/);
  });

  it('rejects a negative rest timer', () => {
    expect(() => useSettingsStore.getState().setDefaultRestSeconds(-5)).toThrow(/invalid value/);
  });

  it('rejects a non-positive increment', () => {
    expect(() => useSettingsStore.getState().setDefaultIncrement(0)).toThrow(/invalid value/);
  });

  it('defaults searchBarPosition to top', () => {
    expect(useSettingsStore.getState().searchBarPosition).toBe('top');
  });

  it('persists searchBarPosition to app_settings and updates state', () => {
    useSettingsStore.getState().setSearchBarPosition(SEARCH_BAR_POSITIONS.BOTTOM);
    expect(useSettingsStore.getState().searchBarPosition).toBe('bottom');
    expect(getSetting(getDatabase(), 'searchBarPosition')).toBe('bottom');
  });

  it('rejects an invalid search bar position', () => {
    expect(() => useSettingsStore.getState().setSearchBarPosition('left')).toThrow(/invalid position/);
  });
});

describe('settingsStore — AI config', () => {
  it('persists provider/model/endpoint to SQLite and the API key to the keystore', async () => {
    await useSettingsStore.getState().setAiConfig({
      provider: AI_PROVIDERS.OPENAI,
      apiKey: 'sk-secret',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
    });
    const db = getDatabase();
    expect(getSetting(db, 'aiProvider')).toBe('openai');
    expect(getSetting(db, 'aiModel')).toBe('gpt-4o-mini');
    expect(getSetting(db, 'aiEndpoint')).toBe('https://api.openai.com/v1');
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBe('sk-secret');
    expect(useSettingsStore.getState().ai).toEqual({
      provider: 'openai',
      apiKey: 'sk-secret',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
    });
  });

  it('deletes the API key when setAiConfig receives an empty key', async () => {
    await useSettingsStore.getState().setAiConfig({ provider: AI_PROVIDERS.OPENAI, apiKey: 'sk-x' });
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBe('sk-x');
    await useSettingsStore.getState().setAiConfig({ apiKey: '' });
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBeNull();
    expect(useSettingsStore.getState().ai.apiKey).toBe('');
  });

  it('rejects an unknown provider', async () => {
    await expect(
      useSettingsStore.getState().setAiConfig({ provider: 'grok' }),
    ).rejects.toThrow(/invalid provider/);
  });

  it('persists custom endpoint configuration', async () => {
    await useSettingsStore.getState().setAiConfig({
      provider: AI_PROVIDERS.CUSTOM,
      apiKey: 'sk-custom',
      model: 'local-llama',
      endpoint: 'https://my-server.example/v1',
    });
    const db = getDatabase();
    expect(getSetting(db, 'aiProvider')).toBe('custom');
    expect(getSetting(db, 'aiEndpoint')).toBe('https://my-server.example/v1');
  });
});

describe('settingsStore — loadSettings (restart hydration)', () => {
  it('hydrates state from SQLite + keystore on load', async () => {
    // Simulate a previous session that wrote settings to the stores.
    const db = getDatabase();
    db.execute(
      `INSERT INTO app_settings (key, value) VALUES
        ('theme','dark'), ('unit','kg'),
        ('defaultRestSeconds','90'), ('defaultIncrement','5'),
        ('searchBarPosition','bottom'),
        ('aiProvider','openai'), ('aiModel','gpt-4o-mini'),
        ('aiEndpoint','https://api.openai.com/v1')`,
    );
    await setSecureItem(SECURE_KEYS.AI_API_KEY, 'sk-from-keystore');

    // Reset in-memory state (as if the app just launched with defaults) then
    // load — this is exactly the restart path App.js runs in bootstrap().
    useSettingsStore.setState(DEFAULTS);
    await useSettingsStore.getState().loadSettings();

    const s = useSettingsStore.getState();
    expect(s.theme).toBe(THEME.DARK);
    expect(s.unit).toBe(UNITS.KG);
    expect(s.defaultRestSeconds).toBe(90);
    expect(s.defaultIncrement).toBe(5);
    expect(s.searchBarPosition).toBe('bottom');
    expect(s.ai).toEqual({
      provider: 'openai',
      apiKey: 'sk-from-keystore',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
    });
  });

  it('is a no-op (keeps defaults) when no settings are persisted', async () => {
    await useSettingsStore.getState().loadSettings();
    const s = useSettingsStore.getState();
    expect(s.theme).toBe(THEME.SYSTEM);
    expect(s.unit).toBe(UNITS.LBS);
    expect(s.defaultRestSeconds).toBe(120);
    expect(s.searchBarPosition).toBe('top');
  });
});

// Sanity: the in-memory shared db used by the store actually carries the
// app_settings table from migration 0002 (guards against a regression where the
// store tests would silently pass against an unmigrated db).
describe('settingsStore — db wiring', () => {
  it('the shared db has the app_settings table', () => {
    const { rows } = getDatabase().execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'",
    );
    expect(rows).toHaveLength(1);
  });

  it('setters work against the shared db even without createInMemoryDb', () => {
    useSettingsStore.getState().setUnit(UNITS.KG);
    // A fresh isolated db does NOT see the write — proving the store uses the
    // shared singleton, not a per-call db.
    expect(getSetting(createInMemoryDb(), 'unit')).toBeNull();
    expect(getSetting(getDatabase(), 'unit')).toBe('kg');
  });
});