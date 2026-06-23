// RoutineBuilderScreen — create or edit a routine (issue #4 acceptance).
//
// One screen serves both flows: routed to with { routineId } for edit, or no
// params for create. The builder owns name + folder + an ordered list of
// exercises with per-exercise target sets / reps (min–max) / rest. Reorder is
// via up/down buttons (drag is hard to do dependency-free; the same save path
// commits the new order). A pencil-icon edit entry is the only way to reach
// edit mode (PRD story 33: edit via pencil icon, not long-press).
//
// Mutations delegate to routineStore (createRoutine / editRoutine); folder
// creation delegates to routineStore.createFolder. The AddExerciseModal is
// reused for picking exercises.

import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AddExerciseModal from '../../components/AddExerciseModal.js';
import OptionPickerModal from '../../components/OptionPickerModal.js';
import { useRoutineStore } from '../../stores/routineStore.js';
import { useWorkoutOperationsStore } from '../../stores/workoutStore.js';
import { getDatabase } from '../../utils/db.js';
import { getRoutineDetail } from '../../db/queries/routineQueries.js';
import { colors, radius, spacing } from '../../theme.js';

const DEFAULT_TARGETS = { targetSets: 3, targetRepsMin: 5, targetRepsMax: 12, targetRestSeconds: 90 };

function clamp(n, min, max) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp,
 *           route: { params?: { routineId?: number } } }} props
 */
export default function RoutineBuilderScreen({ navigation, route }) {
  const routineId = route.params?.routineId;
  const isEdit = routineId != null;

  const folders = useRoutineStore((s) => s.folders);
  const loadFolders = useRoutineStore((s) => s.loadFolders);
  const createFolder = useRoutineStore((s) => s.createFolder);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const editRoutine = useRoutineStore((s) => s.editRoutine);
  const suggestExercises = useWorkoutOperationsStore((s) => s.suggestExercises);
  // Seed the form synchronously from SQLite on mount (edit mode) so there's no
  // setState-in-effect. The detail is read once; the form is then local state.
  const initialDetail = useMemo(
    () => (isEdit ? getRoutineDetail(getDatabase(), routineId) : null),
    [isEdit, routineId],
  );
  const [name, setName] = useState(() => initialDetail?.name ?? '');
  const [folderId, setFolderId] = useState(() => initialDetail?.folder_id ?? null);
  const [exercises, setExercises] = useState(() =>
    (initialDetail?.exercises ?? []).map((re) => ({
      exerciseId: re.exercise_id,
      name: re.exercise_name,
      targetSets: re.target_sets,
      targetRepsMin: re.target_reps_min,
      targetRepsMax: re.target_reps_max,
      targetRestSeconds: re.target_rest_seconds,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false); // folder picker
  const [addOpen, setAddOpen] = useState(false); // add-exercise modal
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);


  const folderName = useMemo(
    () => folders.find((f) => f.id === folderId)?.name ?? 'Unfiled',
    [folders, folderId],
  );

  const canSave = name.trim().length > 0 && exercises.length > 0 && !saving;

  const handleSelectExercise = (exerciseId) => {
    // The add modal returns an exercise id; resolve its name from the store.
    const row = suggestExercises('').find((e) => e.id === exerciseId);
    setExercises((prev) => [
      ...prev,
      { exerciseId, name: row?.name ?? `Exercise ${exerciseId}`, ...DEFAULT_TARGETS },
    ]);
    setAddOpen(false);
  };

  const handleCreateExerciseInline = (newName) => {
    // Delegated to the exercise library creation is out of scope here; prompt
    // the user to create it from the library first. (Issue #4 routines build
    // on top of the existing exercise library, not create-and-add inline.)
    if (newName) setError(`Create “${newName}” in the Exercise Library first, then add it here.`);
    setAddOpen(false);
  };

  const patchExercise = (idx, patch) =>
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const removeExercise = (idx) => setExercises((prev) => prev.filter((_, i) => i !== idx));

  const moveExercise = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const folder = await createFolder(trimmed);
    setFolderId(folder.id);
    setNewFolderName('');
    setNewFolderOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        folderId,
        exercises: exercises.map((e) => ({
          exerciseId: e.exerciseId,
          targetSets: e.targetSets,
          targetRepsMin: e.targetRepsMin,
          targetRepsMax: e.targetRepsMax,
          targetRestSeconds: e.targetRestSeconds,
        })),
      };
      if (isEdit) {
        await editRoutine(routineId, payload);
      } else {
        await createRoutine(payload);
      }
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to save routine.');
    } finally {
      setSaving(false);
    }
  };

  const folderOptions = [
    ...folders.map((f) => ({ id: f.id, name: f.name })),
    { id: '__new__', name: '＋ Create new folder…' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={96}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Routine name">
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push Day A"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        <Field label="Folder">
          <Pressable style={styles.pickerBtn} onPress={() => setPickerOpen(true)}>
            <Text style={styles.pickerBtnText}>{folderName}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Field>

        <Text style={styles.sectionLabel}>
          Exercises{exercises.length ? ` (${exercises.length})` : ''}
        </Text>
        {exercises.length === 0 ? (
          <Text style={styles.empty}>No exercises yet — add one to build the routine.</Text>
        ) : null}
        {exercises.map((ex, idx) => (
          <ExerciseTargetCard
            key={`${ex.exerciseId}-${idx}`}
            exercise={ex}
            index={idx}
            total={exercises.length}
            onPatch={(patch) => patchExercise(idx, patch)}
            onRemove={() => removeExercise(idx)}
            onMove={(dir) => moveExercise(idx, dir)}
          />
        ))}

        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>＋ Add exercise</Text>
        </Pressable>

        <Pressable
          style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!canSave}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create routine'}</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <OptionPickerModal
        visible={pickerOpen}
        title="Folder"
        options={folderOptions}
        value={folderId}
        nullable
        onSelect={(opt) => {
          if (opt && opt.id === '__new__') {
            setNewFolderOpen(true);
          } else {
            setFolderId(opt ? opt.id : null);
          }
        }}
        onClose={() => setPickerOpen(false)}
      />

      <AddExerciseModal
        visible={addOpen}
        onSelect={handleSelectExercise}
        onCreateNew={handleCreateExerciseInline}
        onClose={() => setAddOpen(false)}
      />

      <Modal visible={newFolderOpen} transparent animationType="fade" onRequestClose={() => setNewFolderOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New folder</Text>
            <TextInput
              style={styles.modalInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setNewFolderOpen(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateFolder}>
                <Text style={styles.modalConfirm}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ExerciseTargetCard({ exercise, index, total, onPatch, onRemove, onMove }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{exercise.name}</Text>
        <View style={styles.cardActions}>
          <PressableHit label="↑" disabled={index === 0} onPress={() => onMove(-1)} />
          <PressableHit label="↓" disabled={index === total - 1} onPress={() => onMove(1)} />
          <PressableHit label="✕" danger onPress={onRemove} />
        </View>
      </View>
      <View style={styles.targetsRow}>
        <Stepper
          label="Sets"
          value={exercise.targetSets}
          min={1}
          max={12}
          onDec={() => onPatch({ targetSets: clamp(exercise.targetSets - 1, 1, 12) })}
          onInc={() => onPatch({ targetSets: clamp(exercise.targetSets + 1, 1, 12) })}
        />
        <Stepper
          label="Reps min"
          value={exercise.targetRepsMin}
          min={1}
          max={50}
          onDec={() => onPatch({ targetRepsMin: clamp(exercise.targetRepsMin - 1, 1, 50) })}
          onInc={() => onPatch({ targetRepsMin: clamp(exercise.targetRepsMin + 1, 1, 50) })}
        />
        <Stepper
          label="Reps max"
          value={exercise.targetRepsMax}
          min={1}
          max={50}
          onDec={() => onPatch({ targetRepsMax: clamp(exercise.targetRepsMax - 1, 1, 50) })}
          onInc={() => onPatch({ targetRepsMax: clamp(exercise.targetRepsMax + 1, 1, 50) })}
        />
        <Stepper
          label="Rest (s)"
          value={exercise.targetRestSeconds}
          min={0}
          max={600}
          step={15}
          onDec={() => onPatch({ targetRestSeconds: clamp(exercise.targetRestSeconds - 15, 0, 600) })}
          onInc={() => onPatch({ targetRestSeconds: clamp(exercise.targetRestSeconds + 15, 0, 600) })}
        />
      </View>
    </View>
  );
}

function Stepper({ label, value, onDec, onInc, step }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <PressableHit label="−" onPress={onDec} />
        <Text style={styles.stepperValue}>{value}</Text>
        <PressableHit label={step ? `+${step}` : '+'} onPress={onInc} />
      </View>
    </View>
  );
}

function PressableHit({ label, onPress, disabled, danger }) {
  return (
    <Pressable
      hitSlop={6}
      onPress={onPress}
      disabled={disabled}
      style={[styles.hit, disabled && styles.hitDisabled]}
      android_ripple={{ color: colors.primarySoft, radius: 16, foreground: true }}
    >
      <Text style={[styles.hitText, danger && styles.hitTextDanger, disabled && styles.hitTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  field: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerBtnText: { fontSize: 16, color: colors.text },
  chevron: { fontSize: 18, color: colors.textMuted },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.md },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  cardName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  targetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepper: { alignItems: 'center', minWidth: 72 },
  stepperLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperValue: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 28, textAlign: 'center' },
  hit: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  hitDisabled: { opacity: 0.35 },
  hitText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  hitTextDanger: { color: colors.danger },
  hitTextDisabled: { color: colors.textMuted },
  addBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: spacing.md, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, gap: spacing.lg },
  modalCancel: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  modalConfirm: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});