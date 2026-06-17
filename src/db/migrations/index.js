// Ordered migration registry. Append new migrations here; never reorder or
// edit a published migration. Each migration is { version, name, sql }.
import { migration as m0001 } from './0001_initial_schema.js';
import { migration as m0002 } from './0002_app_settings.js';

export const migrations = [m0001, m0002].sort((a, b) => a.version - b.version);

// Highest migration version available in this build.
export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;