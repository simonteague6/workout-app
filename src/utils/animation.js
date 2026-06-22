// animation — shared Reanimated 3 configs and small motion helpers.
//
// Pure spring/timing presets (re-exported from tokens.js for convenience) plus
// an easing resolver so tokens.js stays zero-dependency. Importing this module
// pulls in Reanimated's Easing, which is safe at module load.

export { motion } from '../theme/tokens.js';
import { Easing } from 'react-native-reanimated';
import { motion } from '../theme/tokens.js';

/** ease-out-expo — the preferred "energetic but not bouncy" decay. */
export const easeOutExpo = Easing.out(Easing.exp);

/** Fade-in timing config (ease-out-expo). Pair with withTiming. */
export const fadeIn = { duration: motion.fadeIn.duration, easing: easeOutExpo };

/** Fade-out timing config (ease-in). Pair with withTiming. */
export const fadeOut = { duration: motion.fadeOut.duration, easing: Easing.in(Easing.exp) };

// Re-export the spring configs individually for ergonomic imports.
export const setCompleteSpring = motion.setCompleteSpring;
export const addSetSpring = motion.addSetSpring;
export const cardEnterSpring = motion.cardEnterSpring;
export const ringSpring = motion.ringSpring;

/** Ms delay between sequenced reveals (finish-screen stats, etc.). */
export const staggerDelay = motion.staggerDelay;