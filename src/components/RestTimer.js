// RestTimer — compact circular rest countdown that floats at the top of the
// live session.
//
// Reads restTimerEndsAt / restTimerTotalSeconds from workoutStore. Fades in
// when a timer is running, depletes a Skia progress ring (smoothly animated
// via Reanimated), shows the remaining time in the center, and pulses/flashes
// in the final 10 seconds. The +30s control calls addRestTime. Sticky — it
// sits above the scrolling set list so it's always glanceable. A matching
// pulsing dot lives on the resting ExerciseSessionCard and a badge on the
// Workout tab (AppNavigator).
//
// Haptics: hapticsLight('restTimerEnd') fires when the timer reaches zero
// (silenced when the user's haptics setting is 'off'; in 'minimal' the
// rest-timer-end context is explicitly allowed through).

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  interpolateColor,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { useAppTheme, spacing, radius } from '../theme/index.js';
import { hapticsLight } from '../utils/haptics.js';
import Icon from './Icon.js';
import { useWorkoutOperationsStore } from '../stores/workoutStore.js';

const SIZE = 76;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

function formatSeconds(total) {
  const s = Math.max(0, Math.ceil(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function RestTimer() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const endsAt = useWorkoutOperationsStore((s) => s.restTimerEndsAt);
  const total = useWorkoutOperationsStore((s) => s.restTimerTotalSeconds);
  const addRestTime = useWorkoutOperationsStore((s) => s.addRestTime);
  const stopRestTimer = useWorkoutOperationsStore((s) => s.stopRestTimer);

  const [now, setNow] = useState(Date.now());
  const opacity = useSharedValue(0);
  const progress = useSharedValue(0);
  const flash = useSharedValue(0);

  // Per-second tick: update the displayed time and smoothly deplete the ring.
  useEffect(() => {
    if (endsAt == null) {
      opacity.value = withTiming(0, { duration: 180 });
      cancelAnimation(flash);
      flash.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: 220 });
    setNow(Date.now());
    const tick = setInterval(() => {
      const remaining = endsAt - Date.now();
      setNow(Date.now());
      if (remaining <= 0) {
        clearInterval(tick);
        runOnJS(hapticsLight)('restTimerEnd');
        stopRestTimer();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [endsAt, opacity, flash, stopRestTimer]);

  const remaining = endsAt == null ? 0 : Math.max(0, (endsAt - now) / 1000);
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  // Drive the ring smoothly toward the current pct each tick.
  useEffect(() => {
    progress.value = withTiming(pct, { duration: 280, easing: Easing.linear });
  }, [pct, progress]);

  const urgent = endsAt != null && remaining <= 10 && remaining > 0;
  useEffect(() => {
    if (urgent) {
      flash.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 380, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(flash);
      flash.value = 0;
    }
  }, [urgent, flash]);

  // Skia arc path reactive to the progress shared value (60fps depletion).
  const progressPath = useDerivedValue(() => {
    const rect = Skia.XYWHRect(CX - R, CY - R, R * 2, R * 2);
    const p = Skia.PathBuilder.Make().addArc(rect, -90, 360 * progress.value).detach();
    return p;
  });

  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const timeStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [0, 1], [colors.text, colors.danger]),
  }));
  const cardPulse = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + flash.value * 0.06 }],
  }));

  if (endsAt == null) return null;

  return (
    <Animated.View
      style={[styles.wrap, wrapStyle, { paddingTop: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, cardPulse]}>
        <View style={styles.ringWrap}>
          <Canvas style={{ width: SIZE, height: SIZE }}>
            <Circle cx={CX} cy={CY} r={R} style="stroke" strokeWidth={STROKE} color={colors.border} />
            <Path path={progressPath} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colors.accent} />
          </Canvas>
          <Animated.Text style={[styles.time, timeStyle]} allowFontScaling={false}>
            {formatSeconds(remaining)}
          </Animated.Text>
        </View>

        <View style={styles.side}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>REST</Text>
          <Pressable
            style={[styles.add30, { borderColor: colors.accent }]}
            onPress={() => addRestTime(30)}
            hitSlop={10}
            android_ripple={{ color: colors.accentSoft, radius: 18 }}
          >
            <Icon name="plus" size={14} color={colors.accent} strokeWidth={3} />
            <Text style={[styles.add30Text, { color: colors.accent }]}>30s</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  time: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  side: { marginLeft: spacing.sm, alignItems: 'flex-start' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  add30: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 3,
  },
  add30Text: { fontSize: 12, fontWeight: '700' },
});