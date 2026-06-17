const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// Redirect the Node-only `node:sqlite` built-in to a runtime stub so Metro can
// bundle src/utils/db.js for React Native. Jest does not consult
// metro.config.js, so tests still resolve the real built-in node:sqlite. The
// stub (src/utils/rn-stubs/node-sqlite.js) is never executed on device because
// the op-sqlite adapter loads first.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'node:sqlite': path.resolve(__dirname, 'src/utils/rn-stubs/node-sqlite.js'),
};

module.exports = config;