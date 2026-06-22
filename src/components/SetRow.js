// SetRow — one exercise_set row inside a live session exercise card.
//
// Layout: [marker chip] [previous] [weight input] [reps input] [check ring]
//   * The marker chip REPLACES the old set-number column: it shows the set
//     number and is colored by set type. Tapping cycles
//     Normal → Warm-up → Drop-set → Failure (green / amber / violet / red).
//   * The "previous" column shows the last session's set at this index.
//   * weight is stored canonically in kg and shown in the user's unit; edits
//     convert back to kg on commit (blur). reps is an integer.
//   * Completion: an animated check ring (Reanimated) fills green with a scale
//     pop; the row dims to a "done" state with a green left accent rail.
//   * Haptics: hapticsMedium('setComplete') fires on completion.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';

import { useSettingsStore } from '../stores/settingsStore.js';
import { kgToDisplay, displayToKg } from '../utils/formatters.js';
import { useAppTheme, SET_TYPE_MARKERS, spacing, radius } from '../theme/index.js';
import { setCompleteSpring } from '../utils/animation.js';
import { hapticsMedium } from '../utils/haptics.js';
import Icon from './Icon.js';

function displayWeight(kg, unit) {
  if (kg == null || kg === '') return '';
  const v = kgToDisplay(Number(kg), unit);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * @param {object} props
 * @param {object} props.set               exercise_set row
 * @param {number} props.index             1-based set number
 * @param {{weight,reps,set_type}|null} [props.previous] prior session set at this index
 * @param {boolean} [props.hideWeight]     bodyweight/flexibility/cardio hide the weight field
 * @param {() => void} props.onCycleType   marker tap
 * @param {(w: number|null) => void} props.onWeight   commit weight (kg)
 * @param {(r: number|null) => void} props.onReps     commit reps
 * @param {() => void} props.onComplete    check ring tap
 * @param {() => void} [props.onDelete]    long-press to delete
 */
export default function SetRow({ set, index, previous, hideWeight, onCycleType, onWeight, onReps, onComplete, onDelete }) {
  const { colors } = useAppTheme();
  const unit = useSettingsStore((s) => s.unit);
  const marker = SET_TYPE_MARKERS[set.set_type] ?? SET_TYPE_MARKERS.normal;
  const markerFg = colors[marker.tone];
  const markerBg = colors[marker.soft];
  const completed = set.is_completed === 1;

  const [weight, setWeight] = useState(displayWeight(set.weight, unit));
  const [reps, setReps] = useState(set.reps == null ? '' : String(set.reps));

  // Re-sync local inputs when the underlying set changes (pre-fill, substitute,
  // DB-driven reload). Inputs are also locked once the set is complete.
  useEffect(() => {
    setWeight(displayWeight(set.weight, unit));
  }, [set.weight, unit]);
  useEffect(() => {
    setReps(set.reps == null ? '' : String(set.reps));
  }, [set.reps]);

  const commitWeight = () => {
    if (hideWeight) return;
    const parsed = parseFloat(weight);
    if (weight === '' || Number.isNaN(parsed)) {
      onWeight(null);
    } else {
      onWeight(displayToKg(parsed, unit));
    }
  };
  const commitReps = () => {
    const parsed = parseInt(reps, 10);
    onReps(Number.isNaN(parsed) ? null : parsed);
  };

  // Completion animation: fill drives color/opacity, pop drives the scale pop.
  const fill = useSharedValue(completed ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    fill.value = withSpring(completed ? 1 : 0, setCompleteSpring);
    if (completed) {
      // Quick shrink → spring pop with overshoot for the "snapped" feel.
      pop.value = withSequence(
        withTiming(0.6, { duration: 70 }),
        withSpring(1, setCompleteSpring),
      );
      runOnJS(hapticsMedium)('setComplete');
    } else {
      pop.value = withTiming(1, { duration: 120 });
    }
  }, [completed, fill, pop]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: 1 - fill.value * 0.4 }));
  const accentStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scaleY: 0.4 + fill.value * 0.6 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: pop.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <Animated.View style={[styles.leftAccent, { backgroundColor: colors.accent }, accentStyle]} />

      <Pressable
        style={[styles.marker, { backgroundColor: markerBg, borderColor: markerFg }]}
        onPress={onCycleType}
        hitSlop={6}
        android_ripple={{ color: markerBg, radius: 16 }}
        onLongPress={onDelete}
      >
        <Text style={[styles.markerText, { color: markerFg }]}>{index}</Text>
      </Pressable>

      <View style={styles.previous}>
        {previous ? (
          <Text style={styles.previousText} numberOfLines={1}>
            {displayWeight(previous.weight, unit)} × {previous.reps ?? '-'}
          </Text>
        ) : (
          <Text style={styles.previousMuted}>—</Text>
        )}
      </View>

      {hideWeight ? (
        <Text style={[styles.input, styles.weightInput, styles.weightDash]}>—</Text>
      ) : (
        <TextInput
          style={[styles.input, styles.weightInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={weight}
          onChangeText={setWeight}
          onBlur={commitWeight}
          keyboardType="numeric"
          returnKeyType="done"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          editable={!completed}
        />
      )}
      {hideWeight ? null : <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>}

      <TextInput
        style={[styles.input, styles.repsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        value={reps}
        onChangeText={setReps}
        onBlur={commitReps}
        keyboardType="numeric"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        editable={!completed}
      />
      <Text style={[styles.unitLabel, { color: colors.textMuted }]}>reps</Text>

      <Pressable
        style={styles.check}
        onPress={onComplete}
        hitSlop={8}
        android_ripple={{ color: colors.accentSoft, radius: 20 }}
      >
        <View style={[styles.ringHollow, { borderColor: completed ? colors.accent : colors.border }]} />
        <Animated.View style={[styles.ringFill, { backgroundColor: colors.accent }, fillStyle]} />
        <Animated.View style={[styles.checkIcon, checkStyle]} pointerEvents="none">
          <Icon name="check" size={18} color="#06251A" strokeWidth={3} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#1CE882',
  },
  marker: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  markerText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  previous: { width: 72, marginRight: spacing.sm },
  previousText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  previousMuted: { fontSize: 12 },
  input: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 52,
    textAlign: 'center',
  },
  weightInput: { width: 64 },
  weightDash: { textAlign: 'center', lineHeight: 32, fontWeight: '700' },
  repsInput: { width: 52, marginLeft: spacing.xs },
  unit: { marginLeft: 4, marginRight: spacing.sm, fontSize: 12, fontWeight: '600' },
  unitLabel: { marginLeft: 4, fontSize: 12, fontWeight: '600' },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  ringHollow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 2,
  },
  ringFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  checkIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});