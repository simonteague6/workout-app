// exerciseStore — Exercise Library cache (built-in + custom, equal standing).
//
// The store is the public interface for library UI (issue #2): browse/search,
// frequency-sorted listing, custom-exercise creation, metadata editing,
// soft-delete (archive), photo attach, and per-exercise history. Every action
// delegates to exerciseQueries over the shared db adapter (getDatabase), so the
// SAME code runs on-device (op-sqlite) and in Jest (node:sqlite in-memory).
//
// Built-in and custom exercises are never separated — search results mix them
// freely; is_custom is the only differentiator. Archived exercises are excluded
// from the cached `exercises` list (the default search) but their history is
// preserved (ON DELETE RESTRICT + soft-delete flag).

import { create } from 'zustand';

import { getDatabase } from '../utils/db.js';
import * as exerciseQueries from '../db/queries/exerciseQueries.js';

const INITIAL_FILTERS = { muscleGroupId: null, equipmentId: null, exerciseType: null };
const INITIAL_LOOKUPS = { muscleGroups: [], equipment: [] };

/**
 * @typedef {Object} ExerciseStoreState
 * @property {Exercise[]} exercises       cached library rows (sorted by usage)
 * @property {boolean} isLoading
 * @property {string} searchQuery          current name fragment ('' = all)
 * @property {{muscleGroupId: number|null, equipmentId: number|null, exerciseType: string|null}} filters
 * @property {{muscleGroups: LookupOption[], equipment: LookupOption[]}} lookups
 * @property {Exercise|null} currentExercise  resolved row for the detail screen
 * @property {object[]} currentHistory         per-exercise history rows
 * @property {string|null} error
 */

// Re-run the current search (query + filters) and cache results. Shared by
// every mutating action so the list stays in sync after create/edit/archive.
function refreshList(set, get) {
  const db = getDatabase();
  const { searchQuery, filters } = get();
  const exercises = exerciseQueries.searchExercises(db, { query: searchQuery, ...filters });
  set({ exercises });
  return exercises;
}

export const useExerciseStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  exercises: [],
  isLoading: false,
  searchQuery: '',
  filters: { ...INITIAL_FILTERS },
  lookups: { ...INITIAL_LOOKUPS },
  currentExercise: null,
  currentHistory: [],
  error: null,

  // -- lookups & listing ----------------------------------------------------

  /** Load muscle-group + equipment options for the picker UIs. Cached once. */
  loadLookups: async () => {
    const db = getDatabase();
    const lookups = exerciseQueries.getLookupOptions(db);
    set({ lookups });
    return lookups;
  },

  /** Load (or reload) the library: ensures lookups are cached, then runs the
   *  current search so `exercises` reflects usage-frequency ordering. */
  loadLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = getDatabase();
      if (get().lookups.muscleGroups.length === 0) {
        set({ lookups: exerciseQueries.getLookupOptions(db) });
      }
      const exercises = refreshList(set, get);
      set({ isLoading: false });
      return exercises;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /** Search by name fragment, keeping the current filters. Pass '' for all. */
  search: async (query) => {
    set({ searchQuery: query ?? '', isLoading: true, error: null });
    try {
      const exercises = refreshList(set, get);
      set({ isLoading: false });
      return exercises;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /** Merge filter overrides (muscleGroupId / equipmentId / exerciseType) and
   *  re-run the search. Pass null to clear a filter. */
  setFilters: async (filterPatch) => {
    set({ filters: { ...get().filters, ...filterPatch }, isLoading: true, error: null });
    try {
      const exercises = refreshList(set, get);
      set({ isLoading: false });
      return exercises;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /** Clear all filters and re-run the search with the current query. */
  clearFilters: async () => {
    set({ filters: { ...INITIAL_FILTERS }, isLoading: true, error: null });
    try {
      const exercises = refreshList(set, get);
      set({ isLoading: false });
      return exercises;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  // -- detail ---------------------------------------------------------------

  /** Load one resolved exercise row into `currentExercise` for the detail card. */
  loadExercise: async (id) => {
    const db = getDatabase();
    const exercise = exerciseQueries.getExerciseById(db, id);
    set({ currentExercise: exercise });
    return exercise;
  },

  /** Replace the cached current exercise (e.g. after an inline edit). */
  setCurrentExercise: (exercise) => set({ currentExercise: exercise }),

  /** Load per-exercise history into `currentHistory` (detail-card link target). */
  loadHistory: async (id) => {
    const db = getDatabase();
    const history = exerciseQueries.getExerciseHistory(db, id);
    set({ currentHistory: history });
    return history;
  },

  // -- mutations ------------------------------------------------------------

  /** Create a custom exercise (is_custom = 1) and refresh the cached list.
   *  Throws on missing/duplicate name or invalid enum (see exerciseQueries). */
  createCustomExercise: async (input) => {
    const db = getDatabase();
    const created = exerciseQueries.createCustomExercise(db, input);
    refreshList(set, get);
    return created;
  },

  /** Edit any exercise's metadata (built-in or custom). Only supplied fields
   *  are written; the cached list + currentExercise are refreshed. */
  updateExerciseMetadata: async (id, patch) => {
    const db = getDatabase();
    const updated = exerciseQueries.updateExercise(db, id, patch);
    if (get().currentExercise?.id === id) set({ currentExercise: updated });
    refreshList(set, get);
    return updated;
  },

  /** Soft-delete (archive) an exercise. It leaves the cached list (default
   *  search excludes archived) but preserves all historical rows. */
  archiveExercise: async (id) => {
    const db = getDatabase();
    const archived = exerciseQueries.archiveExercise(db, id);
    refreshList(set, get);
    return archived;
  },

  /** Restore an archived exercise to the default search. */
  unarchiveExercise: async (id) => {
    const db = getDatabase();
    const restored = exerciseQueries.unarchiveExercise(db, id);
    refreshList(set, get);
    return restored;
  },

  /** Attach/replace/clear the photo path for any exercise. */
  setPhotoPath: async (id, photoPath) => {
    const db = getDatabase();
    const updated = exerciseQueries.setPhotoPath(db, id, photoPath);
    if (get().currentExercise?.id === id) set({ currentExercise: updated });
    refreshList(set, get);
    return updated;
  },
}));