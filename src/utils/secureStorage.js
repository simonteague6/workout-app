// secureStorage — secret storage with a platform-aware implementation.
//
//   On device (React Native / Expo): expo-secure-store (Android keystore /
//     iOS keychain). Values are encrypted at rest by the OS.
//   In Node (Jest / build scripts): a process-scoped in-memory map, so the
//     same code path is exercised by store tests without a native runtime.
//
// Only secrets live here — currently the AI API key. Non-secret settings
// persist in the app_settings SQLite table. Secrets never touch SQLite, so a
// JSON export/import never leaks credentials.

const AI_API_KEY = 'ai_api_key';

// Process-scoped fallback used only when no native secure store is available
// (Node). On device this map is never read.
const _mem = new Map();

function isNodeRuntime() {
  // React Native ships a `process` global but without `versions.node`.
  return typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
}

function expoSecureStore() {
  // Lazy require: Node never evaluates the native import. In Node this throws
  // and the caller falls back to the in-memory store.
  return require('expo-secure-store');
}

export async function setSecureItem(key, value) {
  if (isNodeRuntime()) {
    _mem.set(key, value);
    return;
  }
  await expoSecureStore().setItemAsync(key, value);
}

export async function getSecureItem(key) {
  if (isNodeRuntime()) {
    return _mem.has(key) ? _mem.get(key) : null;
  }
  return expoSecureStore().getItemAsync(key);
}

export async function deleteSecureItem(key) {
  if (isNodeRuntime()) {
    _mem.delete(key);
    return;
  }
  await expoSecureStore().deleteItemAsync(key);
}

// Test helper: clear the in-memory fallback between store tests so an API key
// set in one test never leaks into another.
export function resetSecureStorageForTesting() {
  _mem.clear();
}

export const SECURE_KEYS = Object.freeze({ AI_API_KEY });