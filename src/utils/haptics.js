// haptics — thin gate around expo-haptics that respects the user's setting.
//
// Setting values (settingsStore.haptics):
//   'full'    — every interaction fires.
//   'minimal' — only set-complete (medium) and rest-timer-end (light) fire.
//   'off'     — nothing fires.
//
// Each helper takes an optional `context` tag so 'minimal' can allow only the
// two meaningful events through. Call sites that aren't a "set complete" or
// "rest timer end" omit the context and are therefore silenced in minimal.
//
// All calls are wrapped so a missing/expo-haptics failure never crashes the UI.

import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '../stores/settingsStore.js';

function level() {
  return useSettingsStore.getState()?.haptics ?? 'full';
}

function fire(style, context, allowContexts) {
  try {
    const lvl = level();
    if (lvl === 'off') return;
    if (lvl === 'minimal' && !allowContexts.includes(context)) return;
    Haptics.impactAsync(style);
  } catch {
    /* expo-haptics unavailable — silent no-op */
  }
}

/**
 * Light impact. In 'minimal' only the rest-timer-end context fires.
 * @param {'restTimerEnd'|'ui'} [context='ui']
 */
export function hapticsLight(context = 'ui') {
  fire(Haptics.ImpactFeedbackStyle.Light, context, ['restTimerEnd']);
}

/**
 * Medium impact — set completion. In 'minimal' only the set-complete context
 * fires.
 * @param {'setComplete'|'ui'} [context='ui']
 */
export function hapticsMedium(context = 'ui') {
  fire(Haptics.ImpactFeedbackStyle.Medium, context, ['setComplete']);
}

/** Heavy impact. Silenced in 'minimal' entirely. */
export function hapticsHeavy() {
  fire(Haptics.ImpactFeedbackStyle.Heavy, 'ui', []);
}