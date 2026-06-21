// SetRow — one ExerciseSet row inside a live session exercise card.
//
// Layout: [#] [marker] [previous] [weight input] [reps input] [✓]
//   * The marker chip tap cycles Normal → Warm-up → Drop-set → Failure.
//   * The "previous" column shows the last session's set at this index (PRD
//     "previous column showing last session").
//   * weight is stored canonically in kg and shown in the user's unit; edits
//     convert back to kg on commit (blur). reps is an integer.
//     store's hierarchy). Completed rows are dimmed with a check.
//
// Kept dependency-free: TextInput + Pressable only.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSettingsStore } from '../stores/settingsStore.js';
import { kgToDisplay, displayToKg } from '../utils/formatters.js';
import { colors, radius, spacing } from '../theme.js';

const MARKERS = {
  normal: { label: '', short: '•', bg: null, fg: colors.textMuted },
  warmup: { label: 'W', short: 'W', bg: colors.warningSoft, fg: colors.warning },
  dropset: { label: 'D', short: 'D', bg: colors.primarySoft, fg: colors.primary },
  failure: { label: 'F', short: 'F', bg: colors.dangerSoft, fg: colors.danger },
};

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
 * @param {() => void} props.onCycleType  marker tap
 * @param {(w: number|null) => void} props.onWeight  commit weight (kg)
 * @param {(r: number|null) => void} props.onReps    commit reps
 * @param {() => void} props.onComplete  checkmark
 * @param {() => void} [props.onDelete]  long-press / swipe to delete
 */
export default function SetRow({ set, index, previous, hideWeight, onCycleType, onWeight, onReps, onComplete, onDelete }) {
  const unit = useSettingsStore((s) => s.unit);
  const marker = MARKERS[set.set_type] ?? MARKERS.normal;
  const completed = set.is_completed === 1;

  const [weight, setWeight] = useState(displayWeight(set.weight, unit));
  const [reps, setReps] = useState(set.reps == null ? '' : String(set.reps));

  // Re-sync local inputs when the underlying set changes (e.g. pre-fill,
  // substitute, or after a DB-driven reload).
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

  return (
    <View style={[styles.row, completed && styles.rowCompleted]}>
      <Text style={styles.index}>{index}</Text>

      <Pressable
        style={[styles.marker, marker.bg ? { backgroundColor: marker.bg } : styles.markerEmpty]}
        onPress={onCycleType}
        hitSlop={6}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', radius: 14 }}
      >
        <Text style={[styles.markerText, { color: marker.fg }]}>{marker.short || '○'}</Text>
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
          style={[styles.input, styles.weightInput]}
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
      {hideWeight ? null : <Text style={styles.unit}>{unit}</Text>}

      <TextInput
        style={[styles.input, styles.repsInput]}
        value={reps}
        onChangeText={setReps}
        onBlur={commitReps}
        keyboardType="numeric"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        editable={!completed}
      />
      <Text style={styles.unitLabel}>reps</Text>

      <Pressable
        style={[styles.check, completed && styles.checkDone]}
        onPress={onComplete}
        hitSlop={8}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', radius: 18 }}
      >
        <Text style={styles.checkText}>{completed ? '✓' : '○'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowCompleted: { opacity: 0.55 },
  index: { width: 22, textAlign: 'center', color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  marker: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  markerEmpty: { borderWidth: 1, borderColor: colors.border },
  markerText: { fontSize: 12, fontWeight: '700' },
  previous: { width: 70, marginRight: spacing.sm },
  previousText: { fontSize: 12, color: colors.textSecondary },
  previousMuted: { fontSize: 12, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    color: colors.text,
    minWidth: 52,
    textAlign: 'center',
  },
  weightInput: { flex: 0, width: 60 },
  weightDash: { textAlign: 'center', lineHeight: 30, color: colors.textMuted },
  repsInput: { width: 48, marginLeft: spacing.xs },
  unit: { marginLeft: 4, marginRight: spacing.sm, fontSize: 12, color: colors.textMuted },
  unitLabel: { marginLeft: 4, fontSize: 12, color: colors.textMuted },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  checkDone: { backgroundColor: colors.success },
  checkText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});