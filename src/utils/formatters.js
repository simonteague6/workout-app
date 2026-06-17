// formatters — display helpers for weight values across unit settings.
//
// Weight storage convention: the app stores every weight canonically in
// KILOGRAMS (exercise_set.weight, body_measurement.weight, exercise
// defaults). The user's `unit` setting (lbs | kg) only controls how values
// are *displayed* and *entered*. On entry, convert the typed value to kg
// (displayToKg); on display, convert kg to the unit (kgToDisplay). This keeps
// the unit toggle correct for every weight at once — nothing is re-stored when
// the user switches units.
//
// Only weight helpers live here for now; date and duration formatters land
// with the issues that render them (#3 rest timer, #6 history).

import { UNITS } from '../stores/settingsStore.js';

// 1 international avoirdupois pound = 0.45359237 kg (exact).
export const LB_TO_KG = 0.45359237;
export const KG_TO_LB = 1 / LB_TO_KG;

/**
 * Convert a weight between any two units. Same-unit is a passthrough (no
 * rounding, no float drift).
 * @param {number} value
 * @param {'lbs'|'kg'} fromUnit
 * @param {'lbs'|'kg'} toUnit
 * @returns {number}
 */
export function convertWeight(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (fromUnit === UNITS.LBS && toUnit === UNITS.KG) return value * LB_TO_KG;
  if (fromUnit === UNITS.KG && toUnit === UNITS.LBS) return value * KG_TO_LB;
  throw new Error(`convertWeight: unsupported conversion ${fromUnit} -> ${toUnit}`);
}

/** Convert a canonically-stored kg value to the user's display unit. */
export function kgToDisplay(kg, displayUnit) {
  return convertWeight(kg, UNITS.KG, displayUnit);
}

/** Convert a value typed in the user's display unit back to canonical kg. */
export function displayToKg(value, displayUnit) {
  return convertWeight(value, displayUnit, UNITS.KG);
}

/** Round to 1 decimal place, then drop a trailing ".0" for clean labels. */
function displayNumber(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Format a canonically-stored kg value for display in the given unit.
 * @returns {string} e.g. "135 lbs" or "61.2 kg"
 */
export function formatWeight(kg, displayUnit) {
  return `${displayNumber(kgToDisplay(kg, displayUnit))} ${displayUnit}`;
}