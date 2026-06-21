// ImportReviewScreen — shows the import results with matched (✓) and
// unmatched (⚠) exercises. User can edit the routine name, create custom
// exercises for unmatched ones, and save the routine.

import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { ScreenContainer, Section, PrimaryButton } from '../../components/SettingsControls.js';
import { useRoutineStore } from '../../stores/routineStore.js';
import { getDatabase } from '../../utils/db.js';
import { createCustomExercise } from '../../db/queries/exerciseQueries.js';
import { colors, spacing, radius } from '../../theme.js';

export default function ImportReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { importResult } = route.params || {};
  const { createRoutine } = useRoutineStore();

  const [routineName, setRoutineName] = useState(importResult?.routineName || 'Imported Routine');
  const [saving, setSaving] = useState(false);

  const exercises = importResult?.exercises || [];
  const matchedCount = exercises.filter((e) => e.matched).length;
  const unmatchedCount = exercises.filter((e) => !e.matched).length;

  async function handleSave() {
    if (!routineName.trim()) {
      Alert.alert('Name required', 'Enter a name for the routine.');
      return;
    }

    const unmatched = exercises.filter((e) => !e.matched);
    if (unmatched.length > 0) {
      Alert.alert(
        'Unmatched exercises',
        `${unmatched.length} exercise(s) are not matched to the library. ` +
        'Tap each unmatched exercise to create or pick one before saving.',
      );
      return;
    }

    setSaving(true);
    try {
      const db = getDatabase();
      const routineInput = {
        name: routineName.trim(),
        exercises: exercises.map((ex) => ({
          exerciseId: ex.matchedExerciseId,
          targetSets: ex.sets,
          targetRepsMin: ex.repsMin,
          targetRepsMax: ex.repsMax,
          targetRestSeconds: ex.restSeconds,
        })),
      };
      await createRoutine(routineInput);
      Alert.alert('Saved', `Routine "${routineName.trim()}" created.`, [
        { text: 'OK', onPress: () => navigation.navigate('More') },
      ]);
    } catch (err) {
      Alert.alert('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCustom(exercise) {
    try {
      const db = getDatabase();
      const created = createCustomExercise(db, {
        name: exercise.name,
        default_rep_range_min: exercise.repsMin,
        default_rep_range_max: exercise.repsMax,
        default_rest_seconds: exercise.restSeconds,
      });
      // Update the exercise in state to mark it as matched
      exercise.matched = true;
      exercise.matchedExerciseId = created.id;
      // Force re-render by updating state
      setRoutineName(routineName);
      Alert.alert('Created', `"${exercise.name}" added to the exercise library.`);
    } catch (err) {
      Alert.alert('Could not create', err.message);
    }
  }

  function handlePickFromLibrary(exercise) {
    navigation.navigate('ExerciseLibrary', {
      onSelect: (selectedExercise) => {
        exercise.matched = true;
        exercise.matchedExerciseId = selectedExercise.id;
        setRoutineName(routineName);
      },
    });
  }

  function renderExercise({ item, index }) {
    return (
      <View style={[styles.exerciseRow, item.matched ? styles.matchedRow : styles.unmatchedRow]}>
        <View style={styles.exerciseHeader}>
          <Text style={[styles.statusIcon, item.matched ? styles.matchedIcon : styles.unmatchedIcon]}>
            {item.matched ? '\u2713' : '\u26A0'}
          </Text>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            {item.matched && item.matchedExerciseName ? (
              <Text style={styles.matchedSubtitle}>Matched: {item.matchedExerciseName}</Text>
            ) : null}
            <Text style={styles.exerciseDetails}>
              {item.sets} x {item.repsMin}-{item.repsMax} reps
              {item.restSeconds ? ` \u00B7 ${item.restSeconds}s rest` : ''}
            </Text>
            <Text style={[styles.matchLabel, item.matched ? styles.matchedLabel : styles.unmatchedLabel]}>
              {item.matched ? 'Matched' : 'Not matched'}
            </Text>
          </View>
        </View>
        {!item.matched && (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleCreateCustom(item)}
            >
              <Text style={styles.actionButtonText}>Create</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.pickButton]}
              onPress={() => handlePickFromLibrary(item)}
            >
              <Text style={[styles.actionButtonText, styles.pickButtonText]}>Pick from library</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer>
      <Section title="Routine name">
        <TextInput
          style={styles.nameInput}
          value={routineName}
          onChangeText={setRoutineName}
          placeholder="Routine name"
          placeholderTextColor={colors.textMuted}
        />
      </Section>

      <Section title={`Exercises (${matchedCount} matched, ${unmatchedCount} unmatched)`}>
        <FlatList
          data={exercises}
          renderItem={renderExercise}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </Section>

      <View style={styles.footer}>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save routine'}
          onPress={handleSave}
          disabled={saving || unmatchedCount > 0}
        />
        <Pressable
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  exerciseRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  matchedRow: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  unmatchedRow: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  matchedIcon: {
    color: colors.success,
  },
  unmatchedIcon: {
    color: colors.warning,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  matchedSubtitle: {
    fontSize: 13,
    color: colors.success,
    marginTop: 1,
  },
  exerciseDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  matchLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchedLabel: {
    color: colors.success,
  },
  unmatchedLabel: {
    color: colors.warning,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginLeft: 24 + spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  pickButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pickButtonText: {
    color: colors.primary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});
