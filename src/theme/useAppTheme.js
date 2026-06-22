// useAppTheme — resolves the user's theme preference (light | dark | system)
// into a concrete palette + motion/elevation/haptics context.
//
// Resolving 'system' uses useColorScheme(), so a system theme follows the OS.
// Dark is the hero; light is supported. Every screen reads colors from the
// `colors` object returned here so a toggle re-renders the whole app at once.
//
// Also surfaces `hapticsLevel` so components can gate their own feedback
// without re-importing the settings store.

import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../stores/settingsStore.js';
import { PALETTE, elevation } from './tokens.js';

/**
 * Resolve the active theme and its palette.
 * @returns {{
 *   resolved: 'light'|'dark',
 *   colors: typeof PALETTE.light,
 *   hapticsLevel: 'full'|'minimal'|'off',
 *   elevation: typeof elevation,
 * }}
 */
export function useAppTheme() {
  const themePref = useSettingsStore((s) => s.theme);
  const hapticsLevel = useSettingsStore((s) => s.haptics) ?? 'full';
  const scheme = useColorScheme();
  const resolved =
    themePref === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : themePref;
  return { resolved, colors: PALETTE[resolved], hapticsLevel, elevation };
}