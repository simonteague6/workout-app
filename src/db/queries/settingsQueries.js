// settingsQueries — CRUD for the app_settings key/value table.
//
// Stores NON-SECRET settings only (theme, unit, default rest timer, default
// increment, AI provider/model/endpoint). Values are strings; callers
// serialize typed values and parse them back. The AI API key is a secret and
// lives in secureStorage, never here.
//
// Convention (matches seed.js): every function takes the db adapter as its
// first argument, so query tests pass createInMemoryDb() directly and store
// actions pass getDatabase().

const TABLE = 'app_settings';

const UPSERT_SQL = `
  INSERT INTO ${TABLE} (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`;

/** Return every setting as a { key: value } map (empty object when none). */
export function getAllSettings(db) {
  const { rows } = db.execute(`SELECT key, value FROM ${TABLE}`);
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/** Return a single setting value, or null when the key is absent. */
export function getSetting(db, key) {
  const { rows } = db.execute(`SELECT value FROM ${TABLE} WHERE key = ?`, [key]);
  return rows.length ? rows[0].value : null;
}

/** Upsert a setting (value is coerced to string). */
export function setSetting(db, key, value) {
  db.execute(UPSERT_SQL, [key, value == null ? '' : String(value)]);
}

/** Remove a setting key (no-op when absent). */
export function deleteSetting(db, key) {
  db.execute(`DELETE FROM ${TABLE} WHERE key = ?`, [key]);
}