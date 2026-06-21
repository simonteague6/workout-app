// RestTimer — the top-bar rest countdown that auto-starts when a set is checked.
//
// Reads restTimerEndsAt / restTimerTotalSeconds from workoutStore. Fades in when
// a timer is running, counts down every second, and fades out when it reaches
// zero (auto-stops via stopRestTimer). The +30s control calls addRestTime. Kept
// dependency-free: Animated for the fade, setInterval for the tick.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useWorkoutStore } from '../stores/workoutStore.js';
import { colors, radius, spacing } from '../theme.js';

function formatSeconds(total) {
  const s = Math.max(0, Math.ceil(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

  const insets = useSafeAreaInsets();
  const endsAt = useWorkoutStore((s) => s.restTimerEndsAt);
  const total = useWorkoutStore((s) => s.restTimerTotalSeconds);
  const addRestTime = useWorkoutStore((s) => s.addRestTime);
  const stopRestTimer = useWorkoutStore((s) => s.stopRestTimer);

  const [now, setNow] = useState(Date.now());
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (endsAt == null) {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const tick = setInterval(() => {
      const remaining = endsAt - Date.now();
      setNow(Date.now());
      if (remaining <= 0) {
        clearInterval(tick);
        stopRestTimer();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [endsAt, opacity, stopRestTimer]);

  if (endsAt == null) return null;

  const remaining = Math.max(0, (endsAt - now) / 1000);
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

    <Animated.View style={[styles.bar, { opacity, paddingTop: insets.top, height: 56 + insets.top }]} pointerEvents="box-none">
      <View style={styles.fill} />
      <View style={[styles.progress, { width: `${pct * 100}%` }]} />
      <View style={styles.content}>
        <Text style={styles.label}>Rest</Text>
        <Text style={styles.count}>{formatSeconds(remaining)}</Text>
        <Pressable
          style={styles.add30}
          android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: 20 }}
          onPress={() => addRestTime(30)}
          hitSlop={10}
        >
          <Text style={styles.add30Text}>+30s</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    zIndex: 10,
  },
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primary },
  progress: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.primarySoft,
    opacity: 0.35,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  label: { color: '#fff', fontSize: 13, fontWeight: '600', opacity: 0.9 },
  count: { color: '#fff', fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  add30: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  add30Text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});