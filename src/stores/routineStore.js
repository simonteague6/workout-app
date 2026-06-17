// routineStore — RoutineFolders + Routine templates.
//
// Empty shell for the scaffold (issue #1). Folder/routine CRUD, routine
// builder (add exercises, target sets/reps/rest, drag reorder), edit, and
// save-as-new from the finish diff are implemented in issue #4.

import { create } from 'zustand';

/**
 * @typedef {Object} RoutineStoreState
 * @property {RoutineFolder[]} folders
 * @property {Routine[]} routines
 * @property {boolean} isLoading
 */

export const useRoutineStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  folders: [],
  routines: [],
  isLoading: false,

  // -- actions (implemented in issue #4) ------------------------------------
  loadFolders: async () => {
    throw new Error('routineStore.loadFolders: not implemented (issue #4)');
  },
  createFolder: async (_name) => {
    throw new Error('routineStore.createFolder: not implemented (issue #4)');
  },
  createRoutine: async (_input) => {
    throw new Error('routineStore.createRoutine: not implemented (issue #4)');
  },
  editRoutine: async (_routineId, _patch) => {
    throw new Error('routineStore.editRoutine: not implemented (issue #4)');
  },
  reorderExercises: async (_routineId, _orderedIds) => {
    throw new Error('routineStore.reorderExercises: not implemented (issue #4)');
  },
  saveAsNewFromDiff: async (_sessionId, _name, _folderId) => {
    throw new Error('routineStore.saveAsNewFromDiff: not implemented (issue #4)');
  },
}));