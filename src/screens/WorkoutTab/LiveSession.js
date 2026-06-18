// LiveSession — the core workout logging screen (issue #3).
//
// Renders the active WorkoutSession tree from workoutStore: the rest-timer top
// bar, one ExerciseSessionCard per exercise (with set rows, the previous column,
// and the three-dots menu), an add-exercise modal (pair-frequency suggestions),
// and the finish flow. All mutations delegate to the store; navigation (open
// exercise detail, finish screen) is passed up to the Workout stack.

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AddExerciseModal from '../../components/AddExerciseModal.js';
import ExerciseSessionCard from '../../components/ExerciseSessionCard.js';
import RestTimer from '../../components/RestTimer.js';
import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useExerciseStore } from '../../stores/exerciseStore.js';
import { colors, radius, spacing } from '../../theme.js';

export default function LiveSession({ navigation }) {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const addSet = useWorkoutStore((s) => s.addSet);
  const toggleCompleteSet = useWorkoutStore((s) => s.toggleCompleteSet);
  const cycleSetType = useWorkoutStore((s) => s.cycleSetType);
  const updateSetFields = useWorkoutStore((s) => s.updateSetFields);
  const deleteSet = useWorkoutStore((s) => s.deleteSet);
  const substituteExercise = useWorkoutStore((s) => s.substituteExercise);
  const removeWorkoutExercise = useWorkoutStore((s) => s.removeWorkoutExercise);
  const reorderExercises = useWorkoutStore((s) => s.reorderExercises);
  const setExerciseNotes = useWorkoutStore((s) => s.setExerciseNotes);
  const createSuperset = useWorkoutStore((s) => s.createSuperset);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const createCustomExercise = useExerciseStore((s) => s.createCustomExercise);

  // Add-exercise modal can run in two modes: 'add' or 'substitute'.
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('add'); // 'add' | { type: 'substitute', workoutExerciseId }
  const [finishing, setFinishing] = useState(false);

  // Keep the header title in sync with the active session.
  useEffect(() => {
    navigation.setOptions({ title: activeSession?.routine_id ? 'Routine' : 'Free Flow' });
  }, [navigation, activeSession?.routine_id]);

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
      // Duplicate name etc. — fall back to the full editor.
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
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No active workout.</Text>
        <Pressable style={styles.startBtn} onPress={() => navigation.navigate('Start')}>
          <Text style={styles.startBtnText}>Start a workout</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RestTimer />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={56}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {activeSession.exercises.length === 0 ? (
            <View style={styles.firstHint}>
              <Text style={styles.firstHintText}>Add your first exercise to start logging.</Text>
            </View>
          ) : null}
          {activeSession.exercises.map((entry, i) => (
            <ExerciseSessionCard
              key={entry.id}
              entry={entry}
              index={i}
              totalExercises={activeSession.exercises.length}
              onOpenDetail={(exerciseId) => navigation.navigate('ExerciseDetail', { exerciseId })}
              onCompleteSet={(setId) => toggleCompleteSet(setId)}
              onCycleType={(setId) => cycleSetType(setId)}
              onUpdateSetFields={(setId, patch) => updateSetFields(setId, patch)}
              onAddSet={(weId) => addSet(weId)}
              onDeleteSet={(setId) => deleteSet(setId)}
              onMenuAction={handleMenuAction}
              onSaveNotes={(weId, notes) => setExerciseNotes(weId, notes)}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable style={styles.addBtn} onPress={openAddModal} android_ripple={{ color: colors.primarySoft }}>
          <Text style={styles.addBtnText}>+ Add exercise</Text>
        </Pressable>
        <Pressable
          style={[styles.finishBtn, finishing && { opacity: 0.6 }]}
          onPress={handleFinish}
          disabled={finishing}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        >
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
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 96, paddingTop: 56 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.lg },
  startBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  startBtnText: { color: '#fff', fontWeight: '600' },
  firstHint: { padding: spacing.xl, alignItems: 'center' },
  firstHintText: { color: colors.textMuted, fontSize: 15 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, marginRight: spacing.sm },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  finishBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  finishBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});