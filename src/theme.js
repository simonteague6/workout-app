// DEPRECATED shim — backward-compat flat theme for the ~25 screens/components
// not yet migrated to src/theme/index.js.
//
// Maps the legacy flat names (colors.primary, spacing.md, radius.sm) onto the
// new token system's LIGHT palette so unmigrated screens keep rendering. Once
// the last importer moves to `../theme/index.js`, delete this file.
//
// NOTE: this intentionally pins to the light palette (the legacy look). New
// work MUST import from src/theme and use useAppTheme() for dark/light support.

import { PALETTE, spacing as tokensSpacing, radius as tokensRadius } from './theme/index.js';

export const colors = Object.freeze({
  background: PALETTE.light.background,
  surface: PALETTE.light.surface,
  border: PALETTE.light.border,
  text: PALETTE.light.text,
  textSecondary: PALETTE.light.textSecondary,
  textMuted: PALETTE.light.textMuted,
  primary: PALETTE.light.accent,
  primarySoft: PALETTE.light.accentSoft,
  danger: PALETTE.light.danger,
  dangerSoft: PALETTE.light.dangerSoft,
  warning: PALETTE.light.warning,
  warningSoft: PALETTE.light.warningSoft,
  success: PALETTE.light.success,
  successSoft: PALETTE.light.successSoft,
  rowAction: PALETTE.light.accent,
});

export const spacing = tokensSpacing;
export const radius = tokensRadius;