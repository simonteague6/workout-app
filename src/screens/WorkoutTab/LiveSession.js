// LiveSession — the core workout logging screen (issue #3).
//
// Renders the active WorkoutSession tree from workoutStore: the floating rest
// timer at top, one ExerciseSessionCard per exercise (with set rows, the
// previous column, and the ellipsis menu), an add-exercise modal, and the
// finish flow. All mutations delegate to the store; navigation (open exercise
// detail, finish screen) is passed up to the Workout stack.
//
// The card whose rest timer is running gets `isResting` so it shows a pulsing
// dot. We track the most-recently-completed exercise locally (the store keeps
// a single global rest timer, not per-exercise) and clear it when the timer
// stops.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AddExerciseModal from '../../components/AddExerciseModal.js';
import ExerciseSessionCard from '../../components/ExerciseSessionCard.js';
import SupersetInterlacedCard from '../../components/SupersetInterlacedCard.js';
import RestTimer from '../../components/RestTimer.js';
import Icon from '../../components/Icon.js';
import { useWorkoutStore, useWorkoutOperationsStore } from '../../stores/workoutStore.js';
import { useExerciseStore } from '../../stores/exerciseStore.js';
import { useAppTheme, spacing, radius } from '../../theme/index.js';

export default function LiveSession({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const restEndsAt = useWorkoutOperationsStore((s) => s.restTimerEndsAt);
  const addExercise = useWorkoutOperationsStore((s) => s.addExercise);
  const addSet = useWorkoutOperationsStore((s) => s.addSet);
  const toggleCompleteSet = useWorkoutOperationsStore((s) => s.toggleCompleteSet);
  const cycleSetType = useWorkoutOperationsStore((s) => s.cycleSetType);
  const updateSetFields = useWorkoutOperationsStore((s) => s.updateSetFields);
  const deleteSet = useWorkoutOperationsStore((s) => s.deleteSet);
  const substituteExercise = useWorkoutOperationsStore((s) => s.substituteExercise);
  const removeWorkoutExercise = useWorkoutOperationsStore((s) => s.removeWorkoutExercise);
  const reorderExercises = useWorkoutOperationsStore((s) => s.reorderExercises);
  const setExerciseNotes = useWorkoutOperationsStore((s) => s.setExerciseNotes);
  const createSuperset = useWorkoutOperationsStore((s) => s.createSuperset);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const createCustomExercise = useExerciseStore((s) => s.createCustomExercise);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('add');
  const [finishing, setFinishing] = useState(false);
  const [restingId, setRestingId] = useState(null);

  useEffect(() => {
    navigation.setOptions({ title: activeSession?.routine_id ? 'Routine' : 'Free Flow' });
  }, [navigation, activeSession?.routine_id]);

  // Clear the per-card resting highlight once the global timer stops.
  useEffect(() => {
    if (restEndsAt == null) setRestingId(null);
  }, [restEndsAt]);

  const openAddModal = () => {
    setMode('add');
    setModalOpen(true);
  };

  const handleSelect = async (exerciseId) => {
    if (mode === 'add') {
      await addExercise(exerciseId);
    } else {
      await substituteExercise(mode.workoutExerciseId, exerciseId);
    }
    setModalOpen(false);
  };

  const handleCreateNew = async (name) => {
    if (!name) {
      setModalOpen(false);
      navigation.navigate('ExerciseEditor');
      return;
    }
    try {
      const created = await createCustomExercise({ name });
      if (mode === 'add') await addExercise(created.id);
      else await substituteExercise(mode.workoutExerciseId, created.id);
    } catch {
      setModalOpen(false);
      navigation.navigate('ExerciseEditor');
      return;
    }
    setModalOpen(false);
  };

  const handleMenuAction = (action, workoutExerciseId) => {
    const exercises = activeSession.exercises;
    const idx = exercises.findIndex((e) => e.id === workoutExerciseId);
    if (action === 'substitute') {
      setMode({ type: 'substitute', workoutExerciseId });
      setModalOpen(true);
    } else if (action === 'superset') {
      const next = exercises[idx + 1];
      if (next) createSuperset([workoutExerciseId, next.id]);
    } else if (action === 'moveUp') {
      const order = exercises.map((e) => e.id);
      [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      reorderExercises(order);
    } else if (action === 'moveDown') {
      const order = exercises.map((e) => e.id);
      [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];
      reorderExercises(order);
    } else if (action === 'remove') {
      removeWorkoutExercise(workoutExerciseId);
    }
  };

  // Record which exercise a completion happened in so its card can show the
  // rest pulse while the global timer runs.
  const handleCompleteSet = (setId) => {
    const owner = activeSession.exercises.find((e) => e.sets.some((s) => s.id === setId));
    if (owner) setRestingId(owner.id);
    toggleCompleteSet(setId);
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      await finishWorkout();
      navigation.replace('Finish');
    } finally {
      setFinishing(false);
    }
  };

  if (!activeSession) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Icon name="dumbbell" size={40} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active workout.</Text>
        <Pressable
          style={[styles.startBtn, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate('Start')}
        >
          <Text style={styles.startBtnText}>Start a workout</Text>
        </Pressable>
      </View>
    );
  }

  const timerClearance = insets.top + 104;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RestTimer />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={timerClearance}
      >
        <ScrollView contentContainerStyle={{ paddingTop: timerClearance, paddingBottom: 96 }} keyboardShouldPersistTaps="handled">
          {activeSession.exercises.length === 0 ? (
            <View style={styles.firstHint}>
              <Icon name="dumbbell" size={36} color={colors.textMuted} />
              <Text style={[styles.firstHintText, { color: colors.textMuted }]}>
                Add your first exercise to start logging.
              </Text>
            </View>
          ) : null}
          {(() => {
            const groups = [];
            const standalone = [];
            for (let i = 0; i < activeSession.exercises.length; i++) {
              const entry = activeSession.exercises[i];
              if (entry.supersetGroupId != null) {
                let group = groups.find((g) => g.groupId === entry.supersetGroupId);
                if (!group) {
                  group = { groupId: entry.supersetGroupId, entries: [], startIndex: i };
                  groups.push(group);
                }
                group.entries.push({ entry, index: i });
              } else {
                standalone.push({ entry, index: i });
              }
            }
            const elements = [];
            for (const { entry, index } of standalone) {
              elements.push(
                <ExerciseSessionCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  totalExercises={activeSession.exercises.length}
                  isResting={restEndsAt != null && restingId === entry.id}
                  onOpenDetail={(exerciseId) => navigation.navigate('ExerciseDetail', { exerciseId })}
                  onCompleteSet={handleCompleteSet}
                  onCycleType={(setId) => cycleSetType(setId)}
                  onUpdateSetFields={(setId, patch) => updateSetFields(setId, patch)}
                  onAddSet={(weId) => addSet(weId)}
                  onDeleteSet={(setId) => deleteSet(setId)}
                  onMenuAction={handleMenuAction}
                  onSaveNotes={(weId, notes) => setExerciseNotes(weId, notes)}
                />,
              );
            }
            for (const group of groups) {
              elements.push(
                <SupersetInterlacedCard
                  key={`superset-${group.groupId}`}
                  groupedExercises={group.entries}
                  totalExercises={activeSession.exercises.length}
                  onOpenDetail={(exerciseId) => navigation.navigate('ExerciseDetail', { exerciseId })}
                  onCompleteSet={handleCompleteSet}
                  onCycleType={(setId) => cycleSetType(setId)}
                  onUpdateSetFields={(setId, patch) => updateSetFields(setId, patch)}
                  onAddSet={(weId) => addSet(weId)}
                  onDeleteSet={(setId) => deleteSet(setId)}
                  onMenuAction={handleMenuAction}
                  onSaveNotes={(weId, notes) => setExerciseNotes(weId, notes)}
                />,
              );
            }
            return elements;
          })()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.addBtn, { borderColor: colors.accent }]}
          onPress={openAddModal}
          android_ripple={{ color: colors.accentSoft }}
        >
          <Icon name="plus" size={18} color={colors.accent} strokeWidth={2.5} />
          <Text style={[styles.addBtnText, { color: colors.accent }]}>Add exercise</Text>
        </Pressable>
        <Pressable
          style={[styles.finishBtn, finishing && { opacity: 0.6 }]}
          onPress={handleFinish}
          disabled={finishing}
          android_ripple={{ color: 'rgba(0,0,0,0.2)' }}
        >
          <Icon name="flag" size={18} color="#06251A" strokeWidth={2.5} />
          <Text style={styles.finishBtnText}>Finish</Text>
        </Pressable>
      </View>

      <AddExerciseModal
        visible={modalOpen}
        onSelect={handleSelect}
        onCreateNew={handleCreateNew}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { fontSize: 16, fontWeight: '600' },
  startBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  startBtnText: { color: '#06251A', fontWeight: '800', fontSize: 15 },
  firstHint: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  firstHintText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  addBtnText: { fontWeight: '700', fontSize: 15 },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: '#1CE882',
    borderRadius: radius.md,
  },
  finishBtnText: { color: '#06251A', fontWeight: '800', fontSize: 15 },
});