// ExerciseEditorScreen — create a custom exercise or edit any exercise's
// metadata (issue #2). Routed to with { exerciseId } for edit, or no params for
// create. Loads lookups + the existing row (edit only), renders
// ExerciseEditorForm, and performs the store mutation on submit.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ExerciseEditorForm from '../../components/ExerciseEditorForm.js';
import { useExerciseStore } from '../../stores/exerciseStore.js';
import { colors } from '../../theme.js';

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp,
 *           route: { params?: { exerciseId?: number } } }} props
 */
export default function ExerciseEditorScreen({ navigation, route }) {
  const exerciseId = route.params?.exerciseId;
  const isEdit = exerciseId != null;

  const lookups = useExerciseStore((s) => s.lookups);
  const currentExercise = useExerciseStore((s) => s.currentExercise);
  const loadLookups = useExerciseStore((s) => s.loadLookups);
  const loadExercise = useExerciseStore((s) => s.loadExercise);
  const createCustomExercise = useExerciseStore((s) => s.createCustomExercise);
  const updateExerciseMetadata = useExerciseStore((s) => s.updateExerciseMetadata);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLookups();
    if (isEdit) loadExercise(exerciseId);
  }, [loadLookups, loadExercise, isEdit, exerciseId]);

  const initial = isEdit ? currentExercise : null;

  const handleSubmit = async (values) => {
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateExerciseMetadata(exerciseId, values);
      } else {
        await createCustomExercise(values);
      }
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to save exercise.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Wait for lookups (and the existing row in edit mode) before rendering. */}
      {lookups.muscleGroups.length === 0 || (isEdit && !currentExercise) ? null : (
        <ExerciseEditorForm
          initial={initial}
          lookups={lookups}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => navigation.canGoBack() && navigation.goBack()}
        />
      )}
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.dangerSoft,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '600',
  },
});