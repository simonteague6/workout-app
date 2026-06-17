-- Workout App — Authoritative SQLite schema
-- This file is the human-readable reference for the *current* shape of the
-- database. The source of truth for applying changes at runtime is the
-- versioned migration runner (src/db/migrations/). Migration 0001 mirrors
-- this file; keep them in sync when the schema changes.
--
-- Foreign-key strategy (per PRD §Data Model):
--   ON DELETE RESTRICT  — exercises referenced by history (prevent data loss)
--   ON DELETE CASCADE   — session -> exercise -> set chains
--   ON DELETE SET NULL  — optional links (routine -> session, substitution)
--
-- All timestamps are ISO-8601 TEXT (UTC). Booleans are INTEGER 0/1.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS muscle_group (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Exercise library
-- ---------------------------------------------------------------------------
-- Built-in (seeded) and custom exercises live in the SAME table with equal
-- standing. force/mechanic/level preserve wrkout source fidelity for analytics.

CREATE TABLE IF NOT EXISTS exercise (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  name                       TEXT NOT NULL UNIQUE,
  primary_muscle_group_id    INTEGER,
  secondary_muscle_group_id  INTEGER,
  equipment_id               INTEGER,
  default_notes              TEXT,
  default_increment          REAL    NOT NULL DEFAULT 2.5,
  default_rep_range_min      INTEGER NOT NULL DEFAULT 5,
  default_rep_range_max      INTEGER NOT NULL DEFAULT 12,
  default_rest_seconds       INTEGER NOT NULL DEFAULT 90,
  exercise_type              TEXT    NOT NULL DEFAULT 'strength'
    CHECK (exercise_type IN ('strength', 'cardio', 'flexibility')),
  force                      TEXT
    CHECK (force IS NULL OR force IN ('push', 'pull', 'static')),
  mechanic                   TEXT
    CHECK (mechanic IS NULL OR mechanic IN ('compound', 'isolation')),
  level                      TEXT,
  is_custom                  INTEGER NOT NULL DEFAULT 0,
  is_archived                INTEGER NOT NULL DEFAULT 0,
  photo_path                 TEXT,
  created_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (primary_muscle_group_id)   REFERENCES muscle_group(id) ON DELETE RESTRICT,
  FOREIGN KEY (secondary_muscle_group_id) REFERENCES muscle_group(id) ON DELETE SET NULL,
  FOREIGN KEY (equipment_id)              REFERENCES equipment(id)    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_primary_muscle   ON exercise(primary_muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_exercise_secondary_muscle ON exercise(secondary_muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_exercise_equipment        ON exercise(equipment_id);
CREATE INDEX IF NOT EXISTS idx_exercise_name             ON exercise(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_exercise_type             ON exercise(exercise_type);
CREATE INDEX IF NOT EXISTS idx_exercise_custom_archived  ON exercise(is_custom, is_archived);

-- ---------------------------------------------------------------------------
-- Routines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS routine_folder (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_routine_folder_sort ON routine_folder(sort_order);

CREATE TABLE IF NOT EXISTS routine (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id   INTEGER,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (folder_id) REFERENCES routine_folder(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_routine_folder ON routine(folder_id);

CREATE TABLE IF NOT EXISTS routine_exercise (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id          INTEGER NOT NULL,
  exercise_id         INTEGER NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  target_sets         INTEGER NOT NULL DEFAULT 3,
  target_reps_min     INTEGER NOT NULL DEFAULT 5,
  target_reps_max     INTEGER NOT NULL DEFAULT 12,
  target_rest_seconds INTEGER NOT NULL DEFAULT 90,
  FOREIGN KEY (routine_id)  REFERENCES routine(id)  ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE RESTRICT,
  UNIQUE (routine_id, exercise_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_routine_exercise_routine  ON routine_exercise(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercise_exercise ON routine_exercise(exercise_id);

-- ---------------------------------------------------------------------------
-- Workout sessions (the live recording of what happened)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workout_session (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at  TEXT,
  routine_id    INTEGER,
  notes         TEXT,
  is_completed  INTEGER NOT NULL DEFAULT 0,
  body_weight   REAL,
  FOREIGN KEY (routine_id) REFERENCES routine(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_session_started  ON workout_session(started_at);
CREATE INDEX IF NOT EXISTS idx_session_routine  ON workout_session(routine_id);
CREATE INDEX IF NOT EXISTS idx_session_complete ON workout_session(is_completed);

CREATE TABLE IF NOT EXISTS workout_exercise (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                          INTEGER NOT NULL,
  exercise_id                         INTEGER NOT NULL,
  sort_order                          INTEGER NOT NULL DEFAULT 0,
  notes                               TEXT,
  substituted_from_routine_exercise_id INTEGER,
  FOREIGN KEY (session_id)   REFERENCES workout_session(id)  ON DELETE CASCADE,
  FOREIGN KEY (exercise_id)  REFERENCES exercise(id)         ON DELETE RESTRICT,
  FOREIGN KEY (substituted_from_routine_exercise_id)
    REFERENCES routine_exercise(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_session    ON workout_exercise(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercise_exercise    ON workout_exercise(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercise_substitute  ON workout_exercise(substituted_from_routine_exercise_id);

CREATE TABLE IF NOT EXISTS exercise_set (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  weight              REAL,
  reps                INTEGER,
  set_type            TEXT NOT NULL DEFAULT 'normal'
    CHECK (set_type IN ('normal', 'warmup', 'dropset', 'failure')),
  is_completed        INTEGER NOT NULL DEFAULT 0,
  rest_timer_duration INTEGER,
  rpe                 INTEGER,
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercise(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exercise_set_we ON exercise_set(workout_exercise_id);

-- ---------------------------------------------------------------------------
-- Supersets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS superset_group (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES workout_session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_superset_group_session ON superset_group(session_id);

CREATE TABLE IF NOT EXISTS superset_member (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  superset_group_id   INTEGER NOT NULL,
  workout_exercise_id INTEGER NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (superset_group_id)   REFERENCES superset_group(id)   ON DELETE CASCADE,
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercise(id) ON DELETE CASCADE,
  UNIQUE (workout_exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_superset_member_group ON superset_member(superset_group_id);

-- ---------------------------------------------------------------------------
-- Smart suggestions (zero-AI exercise pair frequency counter)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exercise_pair_frequency (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_a_id INTEGER NOT NULL,
  exercise_b_id INTEGER NOT NULL,
  count         INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (exercise_a_id) REFERENCES exercise(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_b_id) REFERENCES exercise(id) ON DELETE CASCADE,
  UNIQUE (exercise_a_id, exercise_b_id)
);

CREATE INDEX IF NOT EXISTS idx_pair_freq_a ON exercise_pair_frequency(exercise_a_id);
CREATE INDEX IF NOT EXISTS idx_pair_freq_b ON exercise_pair_frequency(exercise_b_id);

-- ---------------------------------------------------------------------------
-- Body measurements (post-MVP, schema ready)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS body_measurement (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  weight        REAL,
  body_fat_pct  REAL,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_body_measurement_date ON body_measurement(date);

-- ---------------------------------------------------------------------------
-- App settings (key/value, non-secret only)
-- ---------------------------------------------------------------------------
-- Persists theme, unit, default rest timer, default increment, and the AI
-- provider/model/endpoint. The AI API key is intentionally NOT stored here —
-- secrets live in the device keystore via expo-secure-store.

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Migration bookkeeping
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);