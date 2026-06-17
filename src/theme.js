// Shared color tokens for issue #2 UI. The full theme system (light/dark/
// system) lands in issue #7; until then these constants keep the exercise
// library screens visually consistent without scattering hex values.

export const colors = Object.freeze({
  background: '#ffffff',
  surface: '#f7f7f8',
  border: '#e5e7eb',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  primary: '#2563eb', // accent for actions / active filter chips
  primarySoft: '#dbeafe',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  warning: '#d97706', // warm-up / archived markers
  warningSoft: '#fef3c7',
  success: '#16a34a',
  successSoft: '#dcfce7',
  rowAction: '#2563eb', // swipe-to-edit action background
});

export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
});

export const radius = Object.freeze({
  sm: 6,
  md: 10,
  lg: 14,
});