// theme barrel — re-export the token system + the useAppTheme hook.
//
// New screens import from '../theme/index.js' (or '../theme'). The legacy
// flat 'src/theme.js' remains as a backward-compat shim for the ~25 not-yet-
// migrated importers and is deleted once the last one moves over.

export { PALETTE, spacing, radius, typography, elevation, motion, SET_TYPE_MARKERS } from './tokens.js';
export { useAppTheme } from './useAppTheme.js';