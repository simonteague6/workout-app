// Jest config. Query/seed tests run in a plain Node environment using the
// built-in node:sqlite (no React Native runtime needed); the DB adapter
// abstraction lets the same code run on-device under op-sqlite.
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  // Only the db/seed/store logic is tested at the unit level (per AGENTS.md:
  // never test UI rendering, navigation, or component layout).
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};