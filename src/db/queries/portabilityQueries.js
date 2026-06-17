// portabilityQueries — JSON backup/restore + CSV history export.
//
// JSON export dumps every user-data table (lookups, exercises, routines,
// sessions, sets, supersets, pair frequency, measurements) into a versioned
// envelope. JSON import is a full restore: within one transaction it clears
// every table present in the dump (children first) and reinserts the rows in
// dependency order (parents first), preserving primary-key ids so foreign
// keys line up exactly. Import is JSON-only; a non-JSON or malformed file
// throws a descriptive Error for the UI to surface.
//
// CSV export is a flat, spreadsheet-friendly table of workout history:
//   date, exercise, set, weight, reps
// (one row per ExerciseSet, joined to its WorkoutExercise + Exercise +
// WorkoutSession). Import from CSV is intentionally NOT supported (rebuilding
// relational data from a flat sheet is fragile) — see PRD §Data Portability.
//
// Convention (matches seed.js): every function takes the db adapter as its
// first argument.

import { getCurrentVersion } from '../../utils/db.js';

// Backup format version (independent of the SQLite schema version). Bump only
// when the envelope shape changes in a backward-incompatible way.
export const BACKUP_FORMAT_VERSION = 1;

// User-data tables in dependency order: parents before children. Used for
// ordered insert on import; reversed for delete. schema_migrations is
// intentionally excluded (migration state is runtime metadata, not user data).
const TABLES = [
  'muscle_group',
  'equipment',
  'exercise',
  'routine_folder',
  'routine',
  'routine_exercise',
  'workout_session',
  'workout_exercise',
  'exercise_set',
  'superset_group',
  'superset_member',
  'exercise_pair_frequency',
  'body_measurement',
];

// Column names we accept on import. Table names come from our own whitelist
// (TABLES), and values are parameterized, so a hostile backup cannot inject
// SQL — only valid identifiers may name columns.
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function nowIso() {
  return new Date().toISOString();
}

// --- JSON export -----------------------------------------------------------

/**
 * Produce a complete JSON backup string of all user data.
 * @param {object} db adapter
 * @returns {string} JSON envelope { version, exportedAt, schemaVersion, tables }
 */
export function exportToJson(db) {
  const tables = {};
  for (const t of TABLES) {
    const { rows } = db.execute(`SELECT * FROM ${t}`);
    tables[t] = rows;
  }
  const payload = {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    schemaVersion: getCurrentVersion(db),
    tables,
  };
  return JSON.stringify(payload);
}

// --- JSON import -----------------------------------------------------------

/**
 * Restore user data from a JSON backup (string or already-parsed object).
 * Replaces every table present in the dump; tables absent from the dump are
 * left untouched. Runs in a single transaction — on any error nothing is
 * changed. Throws a descriptive Error when the input is not valid JSON or is
 * structurally invalid.
 * @param {object} db adapter
 * @param {string|object} input
 * @returns {{ tables: string[], rows: number }} summary of what was restored
 */
export function importFromJson(db, input) {
  const data = parseBackup(input);
  const { tables } = data;

  // Validate structure up front so a bad file fails before we delete anything.
  for (const t of TABLES) {
    if (!(t in tables)) continue;
    const rows = tables[t];
    if (!Array.isArray(rows)) {
      throw new Error(`Invalid backup: "${t}" must be an array`);
    }
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Invalid backup: "${t}" contains a non-object row`);
      }
      for (const col of Object.keys(row)) {
        if (!IDENTIFIER.test(col)) {
          throw new Error(`Invalid backup: "${t}" has invalid column "${col}"`);
        }
      }
    }
  }

  let rowsAffected = 0;
  const restored = [];
  db.transaction(() => {
    // Phase 1: clear every table the dump provides (children first so FK
    // RESTRICT never trips on a parent we still need to delete).
    for (let i = TABLES.length - 1; i >= 0; i--) {
      const t = TABLES[i];
      if (tables[t] != null) db.execute(`DELETE FROM ${t}`);
    }
    // Phase 2: reinsert in dependency order (parents first) preserving ids.
    for (const t of TABLES) {
      const rows = tables[t];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols
          .map(() => '?')
          .join(', ')})`;
        db.execute(sql, cols.map((c) => row[c]));
        rowsAffected += 1;
      }
      restored.push(t);
    }
  });

  return { tables: restored, rows: rowsAffected };
}

function parseBackup(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (err) {
      throw new Error(`Invalid JSON file: ${err.message}`);
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid backup: expected a JSON object');
  }
  const { tables } = data;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    throw new Error('Invalid backup: missing "tables" object');
  }
  return data;
}

// --- CSV export ------------------------------------------------------------

/**
 * Produce a CSV string of workout history (one row per ExerciseSet).
 * Columns: date, exercise, set, weight, reps.
 * @param {object} db adapter
 * @returns {string} CSV text (RFC 4180: CRLF line endings, quoted fields)
 */
export function exportHistoryToCsv(db) {
  const { rows } = db.execute(`
    SELECT
      substr(s.started_at, 1, 10) AS date,
      e.name                          AS exercise,
      es.sort_order + 1               AS set_number,
      es.weight                        AS weight,
      es.reps                          AS reps
    FROM workout_session s
    JOIN workout_exercise we ON we.session_id = s.id
    JOIN exercise e          ON e.id = we.exercise_id
    JOIN exercise_set es      ON es.workout_exercise_id = we.id
    ORDER BY s.started_at, we.sort_order, es.sort_order
  `);
  const header = ['date', 'exercise', 'set', 'weight', 'reps'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.exercise,
        r.set_number,
        r.weight,
        r.reps,
      ]
        .map(csvField)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

function csvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}