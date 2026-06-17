// exerciseStore — Exercise library cache (built-in + custom, equal standing).
//
// Empty shell for the scaffold (issue #1). Library browsing/search, custom
// exercise creation, metadata editing, archive (preserves history), and
// frequency-sorted listing are implemented in issue #2.

import { create } from 'zustand';

/**
 * @typedef {Object} ExerciseStoreState
 * @property {Exercise[]} exercises       cached library rows (sorted by usage)
 * @property {boolean} isLoading
 * @property {string} searchQuery
 */

export const useExerciseStore = create((set, get) => ({
  // -- state ----------------------------------------------------------------
  exercises: [],
  isLoading: false,
  searchQuery: '',

  // -- actions (implemented in issue #2) ------------------------------------
  loadLibrary: async () => {
    throw new Error('exerciseStore.loadLibrary: not implemented (issue #2)');
  },
  search: async (_query) => {
    throw new Error('exerciseStore.search: not implemented (issue #2)');
  },
  createCustomExercise: async (_input) => {
    throw new Error('exerciseStore.createCustomExercise: not implemented (issue #2)');
  },
  updateExerciseMetadata: async (_exerciseId, _patch) => {
    throw new Error('exerciseStore.updateExerciseMetadata: not implemented (issue #2)');
  },
  archiveExercise: async (_exerciseId) => {
    throw new Error('exerciseStore.archiveExercise: not implemented (issue #2)');
  },
  setPhotoPath: async (_exerciseId, _photoPath) => {
    throw new Error('exerciseStore.setPhotoPath: not implemented (issue #2)');
  },
}));