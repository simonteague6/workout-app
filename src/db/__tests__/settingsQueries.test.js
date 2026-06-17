import { describe, it, expect, beforeEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import {
  getSetting,
  setSetting,
  getAllSettings,
  deleteSetting,
} from '../queries/settingsQueries.js';
import {
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
  resetSecureStorageForTesting,
  SECURE_KEYS,
} from '../../utils/secureStorage.js';

describe('settingsQueries', () => {
  let db;
  beforeEach(() => {
    db = createInMemoryDb();
  });

  it('returns null for an absent key', () => {
    expect(getSetting(db, 'theme')).toBeNull();
  });

  it('inserts and reads back a value', () => {
    setSetting(db, 'theme', 'dark');
    expect(getSetting(db, 'theme')).toBe('dark');
  });

  it('upserts an existing key in place', () => {
    setSetting(db, 'theme', 'dark');
    setSetting(db, 'theme', 'light');
    expect(getSetting(db, 'theme')).toBe('light');
    expect(getAllSettings(db).theme).toBe('light');
  });

  it('coerces non-string values to strings', () => {
    setSetting(db, 'defaultRestSeconds', 90);
    expect(getSetting(db, 'defaultRestSeconds')).toBe('90');
  });

  it('getAllSettings returns every key as a map', () => {
    setSetting(db, 'theme', 'dark');
    setSetting(db, 'unit', 'kg');
    expect(getAllSettings(db)).toEqual({ theme: 'dark', unit: 'kg' });
  });

  it('deleteSetting removes a key', () => {
    setSetting(db, 'theme', 'dark');
    deleteSetting(db, 'theme');
    expect(getSetting(db, 'theme')).toBeNull();
  });
});

describe('secureStorage (Node in-memory fallback)', () => {
  beforeEach(() => {
    resetSecureStorageForTesting();
  });

  it('round-trips a secret', async () => {
    await setSecureItem(SECURE_KEYS.AI_API_KEY, 'sk-test-123');
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBe('sk-test-123');
  });

  it('returns null for a missing secret', async () => {
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBeNull();
  });

  it('overwrites an existing secret', async () => {
    await setSecureItem(SECURE_KEYS.AI_API_KEY, 'old');
    await setSecureItem(SECURE_KEYS.AI_API_KEY, 'new');
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBe('new');
  });

  it('deleteSecureItem removes the secret', async () => {
    await setSecureItem(SECURE_KEYS.AI_API_KEY, 'sk-x');
    await deleteSecureItem(SECURE_KEYS.AI_API_KEY);
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBeNull();
  });

  it('does not leak secrets across tests after reset', async () => {
    await setSecureItem(SECURE_KEYS.AI_API_KEY, 'first');
    resetSecureStorageForTesting();
    expect(await getSecureItem(SECURE_KEYS.AI_API_KEY)).toBeNull();
  });
});