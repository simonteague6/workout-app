// useAppTheme — resolves the user's theme preference (light | dark | system)
// into a concrete palette, so every screen reads colors from one place.
//
// Resolving 'system' uses useColorScheme(), so a system theme follows the OS.
// The palette is intentionally small and shared by the settings screens added
// in issue #7; other tabs adopt these colors in their own issues.

import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../stores/settingsStore.js';

export const PALETTE = Object.freeze({
  light: {
    background: '#ffffff',
    surface: '#f5f5f7',
    text: '#1a1a1a',
    secondary: '#6b7280',
    border: '#e5e7eb',
    accent: '#2563eb',
    danger: '#dc2626',
  },
  dark: {
    background: '#0b0b0d',
    surface: '#17171b',
    text: '#f4f4f5',
    secondary: '#9ca3af',
    border: '#2a2a30',
    accent: '#60a5fa',
    danger: '#f87171',
  },
});

/**
 * Resolve the active theme and its palette.
 * @returns {{ resolved: 'light'|'dark', colors: typeof PALETTE.light }}
 */
export function useAppTheme() {
  const themePref = useSettingsStore((s) => s.theme);
  const scheme = useColorScheme();
  const resolved =
    themePref === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : themePref;
  return { resolved, colors: PALETTE[resolved] };
}