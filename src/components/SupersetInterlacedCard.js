// SupersetInterlacedCard — renders a group of superset exercises with
// interlaced set rows (A1, B1, A2, B2) instead of stacking (A1, A2, B1, B2).
//
// Each set row shows a small exercise label so the user can tell which
// exercise the set belongs to. The card uses a colored left rail + badge
// consistent with ExerciseSessionCard's superset styling.

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import SetRow from './SetRow.js';
import { colors, radius, spacing } from '../theme.js';

const EXERCISE_COLORS = [colors.primary, colors.warning, colors.success, colors.danger];

/**
 * @param {object} props
 * @param {Array<{entry: object, index: number}>} props.groupedExercises
 *   Each entry is a workout_exercise from workoutStore with its .sets array.
 *   index is the 0-based position of the first exercise in the group.
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
export default function SupersetInterlacedCard({
  groupedExercises,
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
  const [menuEntry, setMenuEntry] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEntry, setNotesEntry] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  const handleMenu = (key) => {
    setMenuOpen(false);
    if (!menuEntry) return;
    if (key === 'notes') {
      setNotesDraft(menuEntry.entry.notes ?? '');
      setNotesEntry(menuEntry);
      setNotesOpen(true);
      return;
    }
    onMenuAction(key, menuEntry.entry.id);
  };

  // Build interlaced set list: exercise[0].set[0], exercise[1].set[0],
  // exercise[0].set[1], exercise[1].set[1], ...
  const maxSets = Math.max(...groupedExercises.map((ge) => ge.entry.sets.length));
  const interlacedSets = [];
  for (let s = 0; s < maxSets; s++) {
    for (let e = 0; e < groupedExercises.length; e++) {
      const set = groupedExercises[e].entry.sets[s];
      if (set) {
        interlacedSets.push({
          set,
          exerciseIndex: e,
          exerciseName: groupedExercises[e].entry.exercise.name,
          setIndex: s + 1,
          previous: (groupedExercises[e].entry.previousSets ?? [])[s] ?? null,
        });
      }
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.rail} />
      <View style={{ flex: 1 }}>
        {/* Headers for each exercise in the superset */}
        {groupedExercises.map((ge, ei) => {
          const color = EXERCISE_COLORS[ei % EXERCISE_COLORS.length];
          return (
            <View key={ge.entry.id} style={[styles.header, ei > 0 && { paddingTop: spacing.xs }]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Pressable style={styles.titleWrap} onPress={() => onOpenDetail(ge.entry.exercise.id)}>
                <Text style={styles.title} numberOfLines={1}>
                  {ge.entry.exercise.name}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {ge.entry.exercise.primary_muscle ? ge.entry.exercise.primary_muscle : ''}
                  {ge.entry.exercise.equipment ? ` • ${ge.entry.exercise.equipment}` : ''}
                </Text>
              </Pressable>
              {ge.entry.notes ? (
                <Text style={styles.notesInline} numberOfLines={1}>
                  {ge.entry.notes}
                </Text>
              ) : null}
              <Pressable
                style={styles.dots}
                onPress={() => {
                  setMenuEntry(ge);
                  setMenuOpen(true);
                }}
                hitSlop={10}
              >
                <Text style={styles.dotsText}>⋮</Text>
              </Pressable>
            </View>
          );
        })}

        {/* Column headers */}
        <View style={styles.setColumnHeader}>
          <Text style={[styles.colHead, { width: 22 }]}>#</Text>
          <Text style={[styles.colHead, { width: 26 + spacing.sm, marginLeft: 0 }]}> </Text>
          <Text style={[styles.colHead, { width: 70, marginRight: spacing.sm }]}>Previous</Text>
          <Text style={[styles.colHead, { width: 60 }]}>Weight</Text>
          <Text style={[styles.colHead, { width: 48, marginLeft: spacing.xs }]}>Reps</Text>
        </View>

        {/* Interlaced set rows */}
        {interlacedSets.map((item) => (
          <View key={item.set.id} style={styles.interlacedRow}>
            <View style={[styles.exerciseLabel, { backgroundColor: EXERCISE_COLORS[item.exerciseIndex % EXERCISE_COLORS.length] }]}>
              <Text style={styles.exerciseLabelText}>{item.exerciseName.substring(0, 3).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <SetRow
                set={item.set}
                index={item.setIndex}
                previous={item.previous}
                onCycleType={() => onCycleType(item.set.id)}
                onWeight={(w) => onUpdateSetFields(item.set.id, { weight: w })}
                onReps={(r) => onUpdateSetFields(item.set.id, { reps: r })}
                onComplete={() => onCompleteSet(item.set.id)}
                onDelete={() => onDeleteSet(item.set.id)}
              />
            </View>
          </View>
        ))}

        {/* Add set buttons for each exercise */}
        {groupedExercises.map((ge) => (
          <Pressable key={ge.entry.id} style={styles.addSet} onPress={() => onAddSet(ge.entry.id)} hitSlop={8}>
            <Text style={styles.addSetText}>+ Add set to {ge.entry.exercise.name}</Text>
          </Pressable>
        ))}
      </View>

      {/* Three-dots action sheet. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {menuEntry?.entry.exercise.name ?? ''}
          </Text>
          {[
            { key: 'substitute', label: 'Substitute exercise' },
            { key: 'notes', label: 'Edit notes' },
            { key: 'remove', label: 'Remove exercise', danger: true },
          ].map((m) => (
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
                if (notesEntry) onSaveNotes(notesEntry.entry.id, notesDraft);
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
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rail: { width: 4, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  titleWrap: { flex: 1, paddingVertical: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  notesInline: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginRight: spacing.sm,
    maxWidth: 100,
  },
  dots: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  dotsText: { fontSize: 22, color: colors.textSecondary, fontWeight: '700' },
  setColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 4,
  },
  colHead: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  interlacedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseLabel: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    marginLeft: spacing.sm,
    borderRadius: radius.sm,
  },
  exerciseLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
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
