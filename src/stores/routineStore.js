// routineStore — RoutineFolders + Routine templates (issue #4).
//
// Public interface for the routines UI (Workout tab). Owns the cached folder
// + routine lists, the current routine detail (builder/preview), and the
// folder/routine/finish-diff mutations. Every action delegates to
// routineQueries over the shared db adapter (getDatabase), so the SAME code
// runs on-device (op-sqlite) and in Jest (node:sqlite in-memory).
//
// `editRoutine` is the one-stop save for the routine builder: it updates the
// name + folder AND replaces the routine_exercise rows (targets + order) in a
// single call. Drag-reorder within the builder is committed through the same
// path (the exercises list is the authoritative order).

import { create } from 'zustand';

import { getDatabase } from '../utils/db.js';
import * as routineQueries from '../db/queries/routineQueries.js';

/**
 * @typedef {Object} RoutineStoreState
 * @property {RoutineFolder[]} folders
 * @property {Array<{ id, folder_id, name, created_at, updated_at, folder_name: string|null, exercise_count: number }>} routines
 * @property {object|null} currentRoutine   resolved routine detail (builder / edit)
 * @property {object|null} currentPreview    routine preview with last-session performance
 * @property {boolean} isLoading
 * @property {string|null} error
 */

function refreshFolders() {
  return routineQueries.getFolders(getDatabase());
}

function refreshRoutines() {
  return routineQueries.getRoutines(getDatabase());
}

export const useRoutineStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  folders: [],
  routines: [],
  currentRoutine: null,
  currentPreview: null,
  isLoading: false,
  error: null,

  // -- folders --------------------------------------------------------------

  /** Load all folders into state. */
  loadFolders: async () => {
    set({ folders: refreshFolders(), error: null });
    return get().folders;
  },

  /** Create a folder; refreshes `folders`. Returns the new folder. */
  createFolder: async (name) => {
    const folder = routineQueries.createFolder(getDatabase(), name);
    set({ folders: refreshFolders() });
    return folder;
  },

  // -- routines listing -----------------------------------------------------

  /** Load all routines (with folder name + exercise count) into state. */
  loadRoutines: async () => {
    set({ routines: refreshRoutines(), error: null });
    return get().routines;
  },

  // -- create / detail / edit -----------------------------------------------

  /**
   * Create a Routine + its routine_exercise rows (sort_order from the input
   * order). Refreshes `routines`. Returns the new routine row.
   * @param {{ name: string, folderId?: number|null, exercises: Array<{ exerciseId: number, targetSets?: number, targetRepsMin?: number, targetRepsMax?: number, targetRestSeconds?: number }> }} input
   */
  createRoutine: async (input) => {
    const routine = routineQueries.createRoutine(getDatabase(), input);
    set({ routines: refreshRoutines(), currentRoutine: routineQueries.getRoutineDetail(getDatabase(), routine.id) });
    return routine;
  },

  /**
   * Load a routine's full detail (routine + resolved routine_exercise rows)
   * into `currentRoutine`. Returns the detail.
   */
  loadRoutineDetail: async (routineId) => {
    const detail = routineQueries.getRoutineDetail(getDatabase(), routineId);
    set({ currentRoutine: detail });
    return detail;
  },

  /**
   * Save edits to a routine: update name + folder (when supplied) and replace
   * the routine_exercise rows (targets + order) from `exercises`. This is the
   * single save path for the builder — drag reorder is committed by passing
   * the exercises list in display order. Returns the updated detail and sets
   * `currentRoutine`.
   * @param {number} routineId
   * @param {{ name?: string, folderId?: number|null, exercises?: Array<{ exerciseId: number, targetSets?: number, targetRepsMin?: number, targetRepsMax?: number, targetRestSeconds?: number }> }} patch
   */
  editRoutine: async (routineId, patch) => {
    const db = getDatabase();
    if (patch.name !== undefined) routineQueries.renameRoutine(db, routineId, patch.name);
    if (patch.folderId !== undefined) routineQueries.moveRoutineToFolder(db, routineId, patch.folderId);
    if (patch.exercises !== undefined) routineQueries.setRoutineExercises(db, routineId, patch.exercises);
    const detail = routineQueries.getRoutineDetail(db, routineId);
    set({ currentRoutine: detail, routines: refreshRoutines() });
    return detail;
  },

  /**
   * Rewrite the routine_exercise sort_order from the ordered ids. Used by the
   * builder's drag-reorder when the full exercises list is not being saved.
   */
  reorderExercises: async (routineId, orderedIds) => {
    routineQueries.reorderRoutineExercises(getDatabase(), routineId, orderedIds);
    const detail = routineQueries.getRoutineDetail(getDatabase(), routineId);
    set({ currentRoutine: detail });
    return detail;
  },

  /** Move a routine to a folder (null = unfiled). Refreshes `routines`. */
  moveRoutineToFolder: async (routineId, folderId) => {
    routineQueries.moveRoutineToFolder(getDatabase(), routineId, folderId);
    set({ routines: refreshRoutines() });
    return get().routines.find((r) => r.id === routineId);
  },

  /** Delete a routine. Clears currentRoutine if it was the deleted one. */
  deleteRoutine: async (routineId) => {
    routineQueries.deleteRoutine(getDatabase(), routineId);
    set((state) => ({
      routines: refreshRoutines(),
      currentRoutine: state.currentRoutine?.id === routineId ? null : state.currentRoutine,
    }));
  },

  // -- preview + finish diff ------------------------------------------------

  /**
   * Load the routine preview (exercises + last session performance per
   * exercise) into `currentPreview`. Returns the preview.
   */
  loadRoutinePreview: async (routineId) => {
    const preview = routineQueries.getRoutinePreview(getDatabase(), routineId);
    set({ currentPreview: preview });
    return preview;
  },

  /** Clear the cached preview (after navigating away from the preview screen). */
  clearPreview: () => set({ currentPreview: null }),

  /**
   * Save a finished session as a new routine copy (the finish screen
   * "Save As New" path, PRD story 26). Returns the new routine row and
   * refreshes `routines`.
   */
  saveAsNewFromDiff: async (sessionId, name, folderId) => {
    const routine = routineQueries.saveSessionAsNewRoutine(getDatabase(), sessionId, name, folderId);
    set({ routines: refreshRoutines() });
    return routine;
  },

  /**
   * Update an existing routine so its routine_exercise rows match today's
   * session (the finish screen "Update template" path, PRD story 26). Returns
   * the updated routine detail.
   */
  updateTemplateFromSession: async (routineId, sessionId) => {
    const detail = routineQueries.updateRoutineFromSession(getDatabase(), routineId, sessionId);
    set({ routines: refreshRoutines() });
    return detail;
  },
}));