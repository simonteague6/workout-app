// ExerciseEditorForm — create or edit any exercise's full metadata.
//
// One form serves both flows (issue #2): "Create custom exercise" (acceptance:
// name, primary/secondary muscle picker, equipment picker, default increment,
// rep range, rest timer, notes) and "Edit any exercise metadata" (all fields
// editable for all exercises). The advanced source-fidelity fields
// (force/mechanic/level) are exposed too so editing is genuinely complete.
//
// Controlled: the owning screen passes `initial` (a resolved exercise row or
// null), the cached lookups, and submit/cancel callbacks. The screen performs
// the store mutation (create/update) and navigation.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../theme.js';
import OptionPickerModal from './OptionPickerModal.js';

const EXERCISE_TYPES = [
  { id: 'strength', name: 'Strength' },
  { id: 'cardio', name: 'Cardio' },
  { id: 'flexibility', name: 'Flexibility' },
];
const FORCES = [
  { id: 'push', name: 'Push' },
  { id: 'pull', name: 'Pull' },
  { id: 'static', name: 'Static' },
];
const MECHANICS = [
  { id: 'compound', name: 'Compound' },
  { id: 'isolation', name: 'Isolation' },
];
const LEVELS = [
  { id: 'beginner', name: 'Beginner' },
  { id: 'intermediate', name: 'Intermediate' },
  { id: 'expert', name: 'Expert' },
];

function toFormValues(exercise) {
  if (!exercise) {
    return {
      name: '',
      exercise_type: 'strength',
      primary_muscle_group_id: null,
      secondary_muscle_group_id: null,
      equipment_id: null,
      default_increment: '',
      default_rep_range_min: '',
      default_rep_range_max: '',
      default_rest_seconds: '',
      default_notes: '',
      force: null,
      mechanic: null,
      level: null,
    };
  }
  return {
    name: exercise.name ?? '',
    exercise_type: exercise.exercise_type ?? 'strength',
    primary_muscle_group_id: exercise.primary_muscle_group_id ?? null,
    secondary_muscle_group_id: exercise.secondary_muscle_group_id ?? null,
    equipment_id: exercise.equipment_id ?? null,
    default_increment: exercise.default_increment == null ? '' : String(exercise.default_increment),
    default_rep_range_min: exercise.default_rep_range_min == null ? '' : String(exercise.default_rep_range_min),
    default_rep_range_max: exercise.default_rep_range_max == null ? '' : String(exercise.default_rep_range_max),
    default_rest_seconds: exercise.default_rest_seconds == null ? '' : String(exercise.default_rest_seconds),
    default_notes: exercise.default_notes ?? '',
    force: exercise.force ?? null,
    mechanic: exercise.mechanic ?? null,
    level: exercise.level ?? null,
  };
}

function numOrUndef(v) {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * @param {object} props
 * @param {object|null} props.initial
 * @param {{muscleGroups: LookupOption[], equipment: LookupOption[]}} props.lookups
 * @param {boolean} [props.saving]
 * @param {(values: object) => void} props.onSubmit
 * @param {() => void} props.onCancel
 */
export default function ExerciseEditorForm({ initial, lookups, saving, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => toFormValues(initial));
  const [picker, setPicker] = useState(null); // { field, title, options, nullable }
  const [error, setError] = useState(null);

  // Look up display names for the currently-selected ids.
  const names = useMemo(() => {
    const find = (list, id) => list.find((o) => o.id === id)?.name;
    return {
      primary: find(lookups.muscleGroups, values.primary_muscle_group_id),
      secondary: find(lookups.muscleGroups, values.secondary_muscle_group_id),
      equipment: find(lookups.equipment, values.equipment_id),
      type: EXERCISE_TYPES.find((o) => o.id === values.exercise_type)?.name,
      force: FORCES.find((o) => o.id === values.force)?.name,
      mechanic: MECHANICS.find((o) => o.id === values.mechanic)?.name,
      level: LEVELS.find((o) => o.id === values.level)?.name,
    };
  }, [lookups, values]);

  const set = (field) => (v) => setValues((prev) => ({ ...prev, [field]: v }));

  const handleSubmit = () => {
    const name = values.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    const repMin = numOrUndef(values.default_rep_range_min);
    const repMax = numOrUndef(values.default_rep_range_max);
    if (repMin != null && repMax != null && repMin > repMax) {
      setError('Min reps cannot exceed max reps.');
      return;
    }
    setError(null);
    onSubmit({
      name,
      exercise_type: values.exercise_type,
      primary_muscle_group_id: values.primary_muscle_group_id,
      secondary_muscle_group_id: values.secondary_muscle_group_id,
      equipment_id: values.equipment_id,
      default_increment: numOrUndef(values.default_increment),
      default_rep_range_min: repMin,
      default_rep_range_max: repMax,
      default_rest_seconds: numOrUndef(values.default_rest_seconds),
      default_notes: values.default_notes.trim() ? values.default_notes.trim() : null,
      force: values.force,
      mechanic: values.mechanic,
      level: values.level,
    });
  };

  const openPicker = (field, title, options, nullable = true) =>
    setPicker({ field, title, options, nullable });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label="Name" required>
        <TextInput
          style={styles.textInput}
          value={values.name}
          onChangeText={set('name')}
          placeholder="e.g. Cable Wood Chopper"
          placeholderTextColor={colors.textMuted}
          autoFocus={!initial}
        />
      </Field>

      <Field label="Type">
        <PickerButton
          label={names.type ?? 'Strength'}
          onPress={() => openPicker('exercise_type', 'Exercise type', EXERCISE_TYPES, false)}
        />
      </Field>

      <Field label="Primary muscle group">
        <PickerButton
          label={names.primary ?? 'None'}
          hasValue={Boolean(names.primary)}
          onPress={() => openPicker('primary_muscle_group_id', 'Primary muscle group', lookups.muscleGroups)}
        />
      </Field>

      <Field label="Secondary muscle group">
        <PickerButton
          label={names.secondary ?? 'None'}
          hasValue={Boolean(names.secondary)}
          onPress={() => openPicker('secondary_muscle_group_id', 'Secondary muscle group', lookups.muscleGroups)}
        />
      </Field>

      <Field label="Equipment">
        <PickerButton
          label={names.equipment ?? 'None'}
          hasValue={Boolean(names.equipment)}
          onPress={() => openPicker('equipment_id', 'Equipment', lookups.equipment)}
        />
      </Field>

      <View style={styles.row}>
        <Field label="Default increment" style={styles.half}>
          <TextInput
            style={styles.textInput}
            value={values.default_increment}
            onChangeText={set('default_increment')}
            keyboardType="decimal-pad"
            placeholder="2.5"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field label="Rest (seconds)" style={styles.half}>
          <TextInput
            style={styles.textInput}
            value={values.default_rest_seconds}
            onChangeText={set('default_rest_seconds')}
            keyboardType="number-pad"
            placeholder="90"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
      </View>

      <View style={styles.row}>
        <Field label="Rep min" style={styles.half}>
          <TextInput
            style={styles.textInput}
            value={values.default_rep_range_min}
            onChangeText={set('default_rep_range_min')}
            keyboardType="number-pad"
            placeholder="5"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field label="Rep max" style={styles.half}>
          <TextInput
            style={styles.textInput}
            value={values.default_rep_range_max}
            onChangeText={set('default_rep_range_max')}
            keyboardType="number-pad"
            placeholder="12"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
      </View>

      <Field label="Default notes">
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          value={values.default_notes}
          onChangeText={set('default_notes')}
          placeholder="Form cues, setup instructions…"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </Field>

      <Text style={styles.sectionHeader}>Source metadata (optional)</Text>
      <Field label="Force">
        <PickerButton
          label={names.force ?? 'None'}
          hasValue={Boolean(names.force)}
          onPress={() => openPicker('force', 'Force', FORCES)}
        />
      </Field>
      <Field label="Mechanic">
        <PickerButton
          label={names.mechanic ?? 'None'}
          hasValue={Boolean(names.mechanic)}
          onPress={() => openPicker('mechanic', 'Mechanic', MECHANICS)}
        />
      </Field>
      <Field label="Level">
        <PickerButton
          label={names.level ?? 'None'}
          hasValue={Boolean(names.level)}
          onPress={() => openPicker('level', 'Level', LEVELS)}
        />
      </Field>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <OptionPickerModal
        visible={picker !== null}
        title={picker?.title ?? ''}
        options={picker?.options ?? []}
        value={picker ? values[picker.field] : undefined}
        nullable={picker?.nullable}
        onSelect={(opt) => set(picker.field)(opt ? opt.id : null)}
        onClose={() => setPicker(null)}
      />
    </ScrollView>
  );
}

function Field({ label, required, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function PickerButton({ label, hasValue, onPress }) {
  return (
    <Pressable style={styles.pickerButton} onPress={onPress}>
      <Text style={[styles.pickerText, !hasValue && styles.pickerPlaceholder]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  field: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.danger,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesInput: {
    minHeight: 96,
  },
  pickerButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 15,
    color: colors.text,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});