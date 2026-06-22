// ExerciseSessionCard — one exercise block within the live session.
//
// Dark elevated surface with a thin colored left accent rail (green while the
// exercise has pending sets, dim once every set is done). Header carries the
// exercise name in heavy weight, a muted muscle/equipment tag, a pulsing green
// dot while this exercise is resting, and an ellipsis menu. The menu + notes
// editor are dark-themed bottom sheets with lucide icons per action. Mutations
// delegate to the owning screen via callbacks.

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import SetRow from './SetRow.js';
import Icon from './Icon.js';
import { useAppTheme, spacing, radius, elevation } from '../theme/index.js';
import { cardEnterSpring } from '../utils/animation.js';

const MENU = [
  { key: 'substitute', label: 'Substitute exercise', icon: 'replace' },
  { key: 'superset', label: 'Superset with next', icon: 'layers' },
  { key: 'notes', label: 'Edit notes', icon: 'sticky-note' },
  { key: 'moveUp', label: 'Move up', icon: 'arrow-up' },
  { key: 'moveDown', label: 'Move down', icon: 'arrow-down' },
  { key: 'remove', label: 'Remove exercise', icon: 'trash', danger: true },
];

/** Small pulsing green dot — shown on the card whose rest timer is active. */
function RestDot({ color }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.out(Easing.exp) }),
        withTiming(0, { duration: 520, easing: Easing.in(Easing.exp) }),
      ),
      -1,
      false,
    );
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + p.value * 0.55,
    transform: [{ scale: 0.8 + p.value * 0.45 }],
  }));
  return <Animated.View style={[styles.restDot, { backgroundColor: color }, style]} />;
}

/**
 * @param {object} props
 * @param {object} props.entry        workout_exercise entry from workoutStore
 * @param {number} props.index        0-based position in the session
 * @param {number} props.totalExercises
 * @param {boolean} [props.isResting] true while this exercise's rest timer runs
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
  isResting,
  onOpenDetail,
  onCompleteSet,
  onCycleType,
  onUpdateSetFields,
  onAddSet,
  onDeleteSet,
  onMenuAction,
  onSaveNotes,
}) {
  const { colors, elevation: elev } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(entry.notes ?? '');

  const inSuperset = entry.supersetGroupId != null;
  const prev = entry.previousSets ?? [];
  const hideWeight =
    entry.exercise.force === 'static' ||
    entry.exercise.exercise_type === 'flexibility' ||
    entry.exercise.exercise_type === 'cardio';

  const hasSets = entry.sets.length > 0;
  const allDone = hasSets && entry.sets.every((s) => s.is_completed === 1);
  const railColor = allDone ? colors.border : colors.accent;

  // One-time mount entrance: fade + slight rise.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, cardEnterSpring);
  }, [enter]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 8 }],
  }));

  const handleMenu = (key) => {
    setMenuOpen(false);
    if (key === 'notes') {
      setNotesDraft(entry.notes ?? '');
      setNotesOpen(true);
      return;
    }
    onMenuAction(key, entry.id);
  };

  const visibleMenu = MENU.filter((m) => {
    if (m.key === 'moveUp') return index > 0;
    if (m.key === 'moveDown') return index < totalExercises - 1;
    if (m.key === 'superset') return index < totalExercises - 1;
    return true;
  });

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, ...elev.card },
        enterStyle,
      ]}
    >
      <View style={[styles.rail, { backgroundColor: railColor }]} />

      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable style={styles.titleWrap} onPress={() => onOpenDetail(entry.exercise.id)}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {entry.exercise.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {entry.exercise.primary_muscle ? entry.exercise.primary_muscle : ''}
              {entry.exercise.equipment ? `  ·  ${entry.exercise.equipment}` : ''}
            </Text>
          </Pressable>

          {isResting ? <RestDot color={colors.accent} /> : null}
          {inSuperset ? (
            <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
              <Icon name="layers" size={11} color={colors.accent} strokeWidth={2.5} />
              <Text style={[styles.badgeText, { color: colors.accent }]}>SUPERSET</Text>
            </View>
          ) : null}
          <Pressable style={styles.dots} onPress={() => setMenuOpen(true)} hitSlop={12}>
            <Icon name="ellipsis" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {entry.notes ? (
          <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={2}>
            {entry.notes}
          </Text>
        ) : null}

        <View style={styles.setColumnHeader}>
          <Text style={[styles.colHead, { color: colors.textMuted, width: 30 + spacing.sm }]}>SET</Text>
          <Text style={[styles.colHead, { color: colors.textMuted, width: 72, marginRight: spacing.sm }]}>PREVIOUS</Text>
          <Text style={[styles.colHead, { color: colors.textMuted, width: 64 }]}>WEIGHT</Text>
          <Text style={[styles.colHead, { color: colors.textMuted, width: 52, marginLeft: spacing.xs }]}>REPS</Text>
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

        <Pressable
          style={styles.addSet}
          onPress={() => onAddSet(entry.id)}
          hitSlop={8}
          android_ripple={{ color: colors.accentSoft, radius: 20 }}
        >
          <Icon name="plus" size={16} color={colors.accent} strokeWidth={2.5} />
          <Text style={[styles.addSetText, { color: colors.accent }]}>Add set</Text>
        </Pressable>
      </View>

      {/* Action sheet. */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, ...elev.sheet }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
            {entry.exercise.name}
          </Text>
          {visibleMenu.map((m) => (
            <Pressable
              key={m.key}
              style={styles.sheetRow}
              onPress={() => handleMenu(m.key)}
              android_ripple={{ color: colors.surface }}
            >
              <Icon name={m.icon} size={18} color={m.danger ? colors.danger : colors.textSecondary} />
              <Text style={[styles.sheetRowText, { color: m.danger ? colors.danger : colors.text }]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Notes editor sheet. */}
      <Modal visible={notesOpen} transparent animationType="fade" onRequestClose={() => setNotesOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNotesOpen(false)} />
        <View style={[styles.notesSheet, { backgroundColor: colors.card, borderColor: colors.border }, elev.modal]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Exercise notes</Text>
          <TextInput
            style={[styles.notesInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Sticky note for this exercise…"
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
          />
          <View style={styles.notesActions}>
            <Pressable onPress={() => setNotesOpen(false)} hitSlop={8}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.accent }]}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rail: { width: 3 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  titleWrap: { flex: 1, paddingVertical: 2 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  restDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    gap: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  dots: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  notes: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    fontSize: 13,
    fontStyle: 'italic',
  },
  setColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  colHead: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  addSetText: { fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  sheetRowText: { fontSize: 16, fontWeight: '600' },
  notesSheet: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '32%',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  saveBtnText: { color: '#06251A', fontSize: 15, fontWeight: '800' },
});