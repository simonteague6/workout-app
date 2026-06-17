// Migration 0002 — app_settings key/value table.
//
// Persists non-secret app preferences (theme, unit, default rest timer,
// default increment, AI provider/model/endpoint) as typed string rows.
// The AI API key is NOT stored here — it lives in the device keystore via
// expo-secure-store (src/utils/secureStorage.js), so secrets never touch
// SQLite. Keep this SQL in sync with the app_settings table block in
// src/db/schema.sql.

export const migration = {
  version: 2,
  name: 'app_settings',
  sql: `-- 0002 app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);`,
};