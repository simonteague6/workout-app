// ExerciseSessionCard — one exercise block within the live session.
//
// Header: exercise name (tap → detail card) + a three-dots menu with the PRD
// actions (substitute, superset, notes, reorder, remove). Body: the set rows
// (each with its previous-session column) and an "Add set" button. Superset
// members render with a colored left rail + badge so paired exercises stack
// visually. The card owns the menu + notes sheet; mutations delegate to the
// owning screen via callbacks.

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import SetRow from './SetRow.js';
import { colors, radius, spacing } from '../theme.js';

const MENU = [
  { key: 'substitute', label: 'Substitute exercise' },
  { key: 'superset', label: 'Superset with next' },
  { key: 'notes', label: 'Edit notes' },
  { key: 'moveUp', label: 'Move up' },
  { key: 'moveDown', label: 'Move down' },
  { key: 'remove', label: 'Remove exercise', danger: true },
];

/**
 * @param {object} props
 * @param {object} props.entry        workout_exercise entry from workoutStore
 * @param {number} props.index        0-based position in the session
 * @param {number} props.totalExercises
 * @param {(exerciseId: number) => void} props.onOpenDetail
 * @param {(setId: number) => void} props.onCompleteSet
 * @param {(setId: number) => void} props.onCycleType
 * @param {(setId: number, patch: object) => void} props.onUpdateSetFields
 * @param {(workoutExerciseId: number) => void} props.onAddSet
 * @param {(setId: number) => void} props.onDeleteSet
 * @param {(action: string, workoutExerciseId: number) => void} props.onMenuAction
 * @param {(workoutExerciseId: number, notes: string) => void} props.onSaveNotes
 */
export default function ExerciseSessionCard({
  entry,
  index,
  totalExercises,
  onOpenDetail,
  onCompleteSet,
  onCycleType,
  onUpdateSetFields,
  onAddSet,
  onDeleteSet,
  onMenuAction,
  onSaveNotes,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(entry.notes ?? '');

  const inSuperset = entry.supersetGroupId != null;
  const prev = entry.previousSets ?? [];
  const hideWeight = entry.exercise.force === 'static' || entry.exercise.exercise_type === 'flexibility' || entry.exercise.exercise_type === 'cardio';

  const handleMenu = (key) => {
    setMenuOpen(false);
    if (key === 'notes') {
      setNotesDraft(entry.notes ?? '');
      setNotesOpen(true);
      return;
    }
    onMenuAction(key, entry.id);
  };

  return (
    <View style={[styles.card, inSuperset && styles.cardSuperset]}>
      {inSuperset ? <View style={styles.rail} /> : null}
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable style={styles.titleWrap} onPress={() => onOpenDetail(entry.exercise.id)}>
            <Text style={styles.title} numberOfLines={1}>
              {entry.exercise.name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {entry.exercise.primary_muscle ? entry.exercise.primary_muscle : ''}
              {entry.exercise.equipment ? ` • ${entry.exercise.equipment}` : ''}
            </Text>
          </Pressable>
          {inSuperset ? <Text style={styles.badge}>SUPERSET</Text> : null}
          <Pressable style={styles.dots} onPress={() => setMenuOpen(true)} hitSlop={10}>
            <Text style={styles.dotsText}>⋮</Text>
          </Pressable>
        </View>

        {entry.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {entry.notes}
          </Text>
        ) : null}

        <View style={styles.setColumnHeader}>
          <Text style={[styles.colHead, { width: 22 }]}>#</Text>
          <Text style={[styles.colHead, { width: 26 + spacing.sm, marginLeft: 0 }]}> </Text>
          <Text style={[styles.colHead, { width: 70, marginRight: spacing.sm }]}>Previous</Text>
          <Text style={[styles.colHead, { width: 60 }]}>Weight</Text>
          <Text style={[styles.colHead, { width: 48, marginLeft: spacing.xs }]}>Reps</Text>
        </View>
        {entry.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i + 1}
            previous={prev[i] ?? null}
            hideWeight={hideWeight}
            onCycleType={() => onCycleType(set.id)}
            onWeight={(w) => onUpdateSetFields(set.id, { weight: w })}
            onReps={(r) => onUpdateSetFields(set.id, { reps: r })}
            onComplete={() => onCompleteSet(set.id)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}

        <Pressable style={styles.addSet} onPress={() => onAddSet(entry.id)} hitSlop={8}>
          <Text style={styles.addSetText}>+ Add set</Text>
        </Pressable>
      </View>

      {/* Three-dots action sheet. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {entry.exercise.name}
          </Text>
          {MENU.filter((m) => {
            if (m.key === 'moveUp') return index > 0;
            if (m.key === 'moveDown') return index < totalExercises - 1;
            if (m.key === 'superset') return index < totalExercises - 1;
            return true;
          }).map((m) => (
            <Pressable
              key={m.key}
              style={styles.sheetRow}
              onPress={() => handleMenu(m.key)}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            >
              <Text style={[styles.sheetRowText, m.danger && { color: colors.danger }]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Notes editor sheet. */}
      <Modal visible={notesOpen} transparent animationType="fade" onRequestClose={() => setNotesOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNotesOpen(false)} />
        <View style={styles.notesSheet}>
          <Text style={styles.sheetTitle}>Exercise notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Sticky note for this exercise…"
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
          />
          <View style={styles.notesActions}>
            <Pressable onPress={() => setNotesOpen(false)} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.saveBtn}
              onPress={() => {
                setNotesOpen(false);
                onSaveNotes(entry.id, notesDraft);
              }}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardSuperset: { backgroundColor: colors.surface },
  rail: { width: 4, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  titleWrap: { flex: 1, paddingVertical: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    marginRight: spacing.sm,
  },
  dots: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  dotsText: { fontSize: 22, color: colors.textSecondary, fontWeight: '700' },
  notes: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  setColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 4,
  },
  colHead: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  addSet: { paddingVertical: spacing.md, paddingLeft: spacing.md },
  addSetText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sheetRow: { paddingVertical: spacing.md },
  sheetRowText: { fontSize: 16, color: colors.text },
  notesSheet: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '35%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  notesActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: spacing.md },
  cancelText: { color: colors.textSecondary, fontSize: 15, marginRight: spacing.lg },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});