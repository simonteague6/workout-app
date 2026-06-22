// tokens — the single source of truth for the app's visual language.
//
// Pure data, zero React dependencies. Consumed by useAppTheme (which resolves
// light/dark) and by the legacy src/theme.js shim (which maps flat names to
// the light palette for the not-yet-migrated screens).
//
// Design language: dark & energetic (Hevy/Strong). Deep near-black surfaces,
// one vivid electric-green accent, heavy tabular numerics, clean line icons.
// Dark is the hero; light is a supported secondary palette.

/**
 * Color palettes for both modes. Every consumer reads from `colors.<key>`,
 * never a raw hex, so a theme toggle re-renders the whole app at once.
 *
 * Set-type markers reuse semantic keys: normal=accent(green), warm-up=warning
 * (amber), drop-set=drop (violet), failure=danger (red). `accentSoft`/etc. are
 * low-alpha tints used for chip backgrounds and soft fills.
 */
export const PALETTE = Object.freeze({
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#14161A',
    textSecondary: '#5C6168',
    textMuted: '#9BA1A8',
    border: '#E6E8EC',
    accent: '#0DB868', // electric green, darkened for light-bg contrast
    accentSoft: 'rgba(13,184,104,0.12)',
    danger: '#E03434',
    dangerSoft: 'rgba(224,52,52,0.10)',
    warning: '#C77700', // amber — warm-up marker
    warningSoft: 'rgba(199,119,0,0.12)',
    drop: '#7C5CE0', // violet — drop-set marker
    dropSoft: 'rgba(124,92,224,0.12)',
    success: '#0DB868',
    successSoft: 'rgba(13,184,104,0.12)',
  },
  dark: {
    background: '#0A0B0D',
    surface: '#121317',
    card: '#17181D',
    text: '#F5F6F7',
    textSecondary: '#9BA1A8',
    textMuted: '#5C6168',
    border: '#22252C',
    accent: '#1CE882', // electric green — the hero accent
    accentSoft: 'rgba(28,232,130,0.14)',
    danger: '#FF5C5C',
    dangerSoft: 'rgba(255,92,92,0.14)',
    warning: '#FFB020',
    warningSoft: 'rgba(255,176,32,0.16)',
    drop: '#A78BFA',
    dropSoft: 'rgba(167,139,250,0.16)',
    success: '#1CE882',
    successSoft: 'rgba(28,232,130,0.14)',
  },
});

/** Spacing scale (px). Additive rhythm: components compose these, never raw px. */
export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
});

/** Corner radii. `pill` for chips/tags; `xl` for sheets/big cards. */
export const radius = Object.freeze({
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
});

/**
 * Typography presets. `numeric` entries carry tabular-nums so weights/reps/
 * timer values don't jitter as digits change. Sizes in px.
 */
export const typography = Object.freeze({
  display: { fontSize: 34, fontWeight: '800', lineHeight: 38, fontVariant: ['tabular-nums'] },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.4 },
  label: { fontSize: 10, fontWeight: '700', lineHeight: 14, letterSpacing: 0.6 },
  numeric: { fontSize: 20, fontWeight: '800', lineHeight: 24, fontVariant: ['tabular-nums'] },
  numericLg: { fontSize: 30, fontWeight: '800', lineHeight: 34, fontVariant: ['tabular-nums'] },
});

/** Elevation presets. Shadow opacities are tuned per mode in useAppTheme. */
export const elevation = Object.freeze({
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, shadowOpacity: 0.28, elevation: 3 },
  modal: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.5, elevation: 12 },
  sheet: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowRadius: 20, shadowOpacity: 0.45, elevation: 10 },
});

/**
 * Motion presets for Reanimated 3. Spring configs are plain objects usable
 * with withSpring(); timing configs pair with withTiming(). No lookups of the
 * easing objects happen at module load beyond the Easing import in animation.js.
 */
export const motion = Object.freeze({
  // Snappy, slight overshoot — set completion pop.
  setCompleteSpring: { damping: 13, stiffness: 240, mass: 0.9, overshootClamping: false, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
  // Quick settle — add-set row entrance.
  addSetSpring: { damping: 18, stiffness: 200, mass: 0.8, overshootClamping: true, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
  // Card entrance — gentle, no bounce.
  cardEnterSpring: { damping: 26, stiffness: 150, mass: 1, overshootClamping: true, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
  // Ring fill — smooth, no overshoot.
  ringSpring: { damping: 22, stiffness: 180, mass: 1, overshootClamping: true, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
  // Fade durations (ms); easing resolved in animation.js to keep this pure data.
  fadeIn: { duration: 220 },
  fadeOut: { duration: 180 },
  staggerDelay: 90, // ms between sequenced stat reveals
});

/**
 * Set-type marker metadata. `key` matches exercise_set.set_type values.
 * `tone` is the PALETTE key for the foreground; `soft` the soft-fill key.
 */
export const SET_TYPE_MARKERS = Object.freeze({
  normal: { tone: 'accent', soft: 'accentSoft', label: '' },
  warmup: { tone: 'warning', soft: 'warningSoft', label: 'W' },
  dropset: { tone: 'drop', soft: 'dropSoft', label: 'D' },
  failure: { tone: 'danger', soft: 'dangerSoft', label: 'F' },
});