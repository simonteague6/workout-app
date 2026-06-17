// Database connection + migration runner.
//
// Exposes one normalized adapter interface used by every query module and
// Zustand store, so the SAME query code runs unchanged on-device (op-sqlite)
// and in Node/Jest (node:sqlite). Stores and queries never touch a native
// API directly — they call adapter.execute / executeBatch / transaction.
//
// Adapter interface (identical across implementations):
//   execute(sql, params = [])          -> { rows: any[], rowsAffected: number, insertId: number|null }
//   executeBatch([{ sql, params }])    -> { rowsAffected: number }
//   transaction(fn)                    -> void  (rolls back on throw)
//   close()                            -> void
//
// Read queries and inserts use `INSERT ... RETURNING *` so callers read the
// full row back from `rows[0]` rather than relying on insertId.

import { migrations, LATEST_SCHEMA_VERSION } from '../db/migrations/index.js';

// Re-export so callers import schema metadata from the db module directly.
export { LATEST_SCHEMA_VERSION };

// ---------------------------------------------------------------------------
// Statement splitter — splits a multi-statement SQL string on `;` while
// respecting single/double-quoted strings and `--` line comments. Used to run
// migration files (authored as one DDL string) statement-by-statement, since
// op-sqlite's execute() handles a single statement per call.
// ---------------------------------------------------------------------------
export function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // line comment: -- ... \n
    if (!inSingle && !inDouble && ch === '-' && next === '-') {
      // skip to end of line
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
    } else if (ch === ';' && !inSingle && !inDouble) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
    } else {
      current += ch;
    }
    i += 1;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

// True when a statement returns a result set (SELECT, WITH, or ... RETURNING).
function returnsRows(sql) {
  // SELECT / WITH / RETURNING produce a result set. A PRAGMA with no
  // assignment (e.g. `PRAGMA foreign_keys`) also returns rows; a PRAGMA
  // assignment (`PRAGMA foreign_keys = ON`) returns none.
  if (/^\s*PRAGMA\b/i.test(sql)) return !/=/i.test(sql);
  return /^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);
}

// ---------------------------------------------------------------------------
// node:sqlite adapter (Node >= 22 built-in). Used in Jest and any Node runtime.
// ---------------------------------------------------------------------------
export class NodeSqliteAdapter {
  constructor(db) {
    this._db = db;
    this._db.exec('PRAGMA foreign_keys = ON');
    this._stmtCache = new Map();
  }

  _prepare(sql) {
    let stmt = this._stmtCache.get(sql);
    if (!stmt) {
      stmt = this._db.prepare(sql);
      this._stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  execute(sql, params = []) {
    const stmt = this._prepare(sql);
    if (returnsRows(sql)) {
      const rows = stmt.all(...params);
      return { rows, rowsAffected: rows.length, insertId: null };
    }
    const r = stmt.run(...params);
    return { rows: [], rowsAffected: r.changes, insertId: r.lastInsertRowid ?? null };
  }

  executeBatch(statements) {
    let rowsAffected = 0;
    for (const { sql, params = [] } of statements) {
      const stmt = this._prepare(sql);
      if (returnsRows(sql)) {
        rowsAffected += stmt.all(...params).length;
      } else {
        rowsAffected += stmt.run(...params).changes;
      }
    }
    return { rowsAffected };
  }

  transaction(fn) {
    this._db.exec('BEGIN');
    try {
      fn();
      this._db.exec('COMMIT');
    } catch (err) {
      try { this._db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
  }

  exec(sql) {
    this._db.exec(sql);
  }

  close() {
    this._stmtCache.clear();
    this._db.close();
  }
}

// ---------------------------------------------------------------------------
// op-sqlite adapter (React Native / Expo). Loaded lazily so Node never
// evaluates the native import.
// ---------------------------------------------------------------------------
export class OpSqliteAdapter {
  constructor(db) {
    this._db = db;
    this._db.executeSync('PRAGMA foreign_keys = ON');
  }

  execute(sql, params = []) {
    const r = this._db.executeSync(sql, params);
    return {
      rows: r.rows ?? [],
      rowsAffected: r.rowsAffected ?? 0,
      insertId: r.insertId ?? r.lastInsertRowid ?? null,
    };
  }

  executeBatch(statements) {
    let rowsAffected = 0;
    for (const { sql, params = [] } of statements) {
      const r = this._db.executeSync(sql, params);
      rowsAffected += r.rowsAffected ?? 0;
    }
    return { rowsAffected };
  }

  transaction(fn) {
    this._db.executeSync('BEGIN');
    try {
      fn();
      this._db.executeSync('COMMIT');
    } catch (err) {
      try { this._db.executeSync('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
  }

  exec(sql) {
    for (const stmt of splitStatements(sql)) {
      this._db.executeSync(stmt, []);
    }
  }

  close() {
    this._db.close();
  }
}

// ---------------------------------------------------------------------------
// Connection factory (platform-aware). Tries op-sqlite; falls back to
// node:sqlite in Node (tests / build scripts).
// ---------------------------------------------------------------------------
function requireOpSqlite() {
  // Lazily require so Node (which cannot load the native module) never imports it.
  return require('@op-engineering/op-sqlite');
}

function loadNodeSqlite() {
  // Node-only built-in. In Node/Jest this resolves to the real module. In the
  // React Native bundle, metro.config.js redirects `node:sqlite` to a stub
  // (src/utils/rn-stubs/node-sqlite.js) so Metro can bundle db.js; the stub is
  // never executed on device because op-sqlite loads successfully first.
  return require('node:sqlite');
}

let _shared = null;

export function openDatabase({ name = 'workout.db', location } = {}) {
  try {
    const { open } = requireOpSqlite();
    const db = open({ name, location: location ?? 'databases' });
    return new OpSqliteAdapter(db);
  } catch {
    // Node path: in-memory for tests, file by name for build scripts.
    const { DatabaseSync } = loadNodeSqlite();
    const target = location === ':memory:' || name === ':memory:' ? ':memory:' : name;
    return new NodeSqliteAdapter(new DatabaseSync(target));
  }
}

export function getDatabase() {
  if (!_shared) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _shared;
}

// ---------------------------------------------------------------------------
// Migration runner — applies every pending migration in version order inside
// a single transaction. Idempotent: re-running with no new migrations is a
// no-op. Returns the version the database is now at.
// ---------------------------------------------------------------------------
export function getCurrentVersion(db) {
  // schema_migrations is created by migration 0001; if it does not exist yet
  // (fresh DB before any migration), the version is 0.
  const { rows } = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
  );
  if (rows.length === 0) return 0;
  const v = db.execute('SELECT MAX(version) AS v FROM schema_migrations');
  return v.rows[0].v ?? 0;
}

export function runMigrations(db) {
  const current = getCurrentVersion(db);
  const pending = migrations.filter((m) => m.version > current);
  if (pending.length === 0) return current;

  db.transaction(() => {
    for (const m of pending) {
      for (const stmt of splitStatements(m.sql)) {
        db.execute(stmt, []);
      }
      db.execute('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [
        m.version,
        m.name,
      ]);
    }
  });
  return LATEST_SCHEMA_VERSION;
}

// Initialize (open + migrate) the shared database. Call once at app startup.
export function initDatabase(options) {
  if (_shared) return _shared;
  _shared = openDatabase(options);
  runMigrations(_shared);
  return _shared;
}

export function resetDatabaseForTesting() {
  if (_shared) {
    _shared.close();
    _shared = null;
  }
}

// Test helper: an isolated in-memory database with migrations applied.
export function createInMemoryDb() {
  const { DatabaseSync } = loadNodeSqlite();
  const db = new NodeSqliteAdapter(new DatabaseSync(':memory:'));
  runMigrations(db);
  return db;
}