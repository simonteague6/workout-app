// React Native stub for the Node-only `node:sqlite` built-in.
//
// Metro resolves `require('node:sqlite')` to this file (see metro.config.js)
// so src/utils/db.js bundles for React Native. This stub is never executed on
// device: the op-sqlite adapter always loads first in openDatabase(), so the
// node:sqlite fallback branch is unreachable. If something ever reaches it in
// RN, fail loudly rather than silently misbehaving.
module.exports = {
  DatabaseSync: function unreachableNodeSqlite() {
    throw new Error(
      'node:sqlite is not available in React Native. The op-sqlite adapter should be used instead.',
    );
  },
};