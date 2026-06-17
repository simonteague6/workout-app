// ExerciseDetailScreen — the exercise detail card (issue #2 acceptance):
// metadata, a history link, and a photo. Built-in and custom exercises share
// the same card. From here the user can edit metadata, capture/attach a photo,
// and archive (soft-delete) — all of which preserve historical workout data.

import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useExerciseStore } from '../../stores/exerciseStore.js';
import { colors, radius, spacing } from '../../theme.js';

function formatDate(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp,
 *           route: { params: { exerciseId: number } } }} props
 */
export default function ExerciseDetailScreen({ navigation, route }) {
  const exerciseId = route.params.exerciseId;
  const exercise = useExerciseStore((s) => s.currentExercise);
  const loadExercise = useExerciseStore((s) => s.loadExercise);
  const setPhotoPath = useExerciseStore((s) => s.setPhotoPath);
  const archiveExercise = useExerciseStore((s) => s.archiveExercise);
  const unarchiveExercise = useExerciseStore((s) => s.unarchiveExercise);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadExercise(exerciseId);
  }, [loadExercise, exerciseId]);

  // Keep the header title in sync once the row resolves.
  useEffect(() => {
    if (exercise) navigation.setOptions({ title: exercise.name });
  }, [navigation, exercise]);

  if (!exercise) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission denied', 'Enable camera access in settings to take a photo.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!r.canceled && r.assets?.[0]) {
      await setPhotoPath(exerciseId, r.assets[0].uri);
    }
  };

  const openLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!r.canceled && r.assets?.[0]) {
      await setPhotoPath(exerciseId, r.assets[0].uri);
    }
  };

  const choosePhotoSource = () => {
    Alert.alert('Add photo', 'Choose a source', [
      { text: 'Take photo', onPress: openCamera },
      { text: 'Choose from library', onPress: openLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      if (exercise.is_archived) await unarchiveExercise(exerciseId);
      else await archiveExercise(exerciseId);
    } catch (err) {
      Alert.alert('Failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert('Remove photo', 'Remove the photo from this exercise?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPhotoPath(exerciseId, null) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Photo */}
      <View style={styles.photoWrap}>
        {exercise.photo_path ? (
          <Pressable onPress={choosePhotoSource} onLongPress={removePhoto}>
            <Image source={{ uri: exercise.photo_path }} style={styles.photo} />
          </Pressable>
        ) : (
          <Pressable style={styles.photoPlaceholder} onPress={choosePhotoSource}>
            <Text style={styles.photoPlaceholderText}>Add photo</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.title}>{exercise.name}</Text>
      <View style={styles.badges}>
        {exercise.is_custom ? <Badge label="Custom" tone="primary" /> : <Badge label="Built-in" tone="muted" />}
        {exercise.is_archived ? <Badge label="Archived" tone="warning" /> : null}
      </View>

      {/* Usage + history link */}
      <Pressable
        style={styles.historyLink}
        onPress={() =>
          navigation.navigate('ExerciseHistory', {
            exerciseId,
            exerciseName: exercise.name,
          })
        }
      >
        <View>
          <Text style={styles.historyLinkTitle}>Workout history</Text>
          <Text style={styles.historyLinkSubtitle}>
            Used in {exercise.usage_count} {exercise.usage_count === 1 ? 'workout' : 'workouts'} • Last: {formatDate(exercise.last_performed_at)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {/* Metadata */}
      <View style={styles.section}>
        <MetaRow label="Type" value={exercise.exercise_type} />
        <MetaRow label="Primary muscle" value={exercise.primary_muscle} />
        <MetaRow label="Secondary muscle" value={exercise.secondary_muscle} />
        <MetaRow label="Equipment" value={exercise.equipment} />
        <MetaRow label="Default increment" value={exercise.default_increment != null ? `${exercise.default_increment}` : null} />
        <MetaRow label="Rep range" value={`${exercise.default_rep_range_min}–${exercise.default_rep_range_max}`} />
        <MetaRow label="Rest" value={`${exercise.default_rest_seconds}s`} />
        <MetaRow label="Force" value={exercise.force} />
        <MetaRow label="Mechanic" value={exercise.mechanic} />
        <MetaRow label="Level" value={exercise.level} />
      </View>

      {exercise.default_notes ? (
        <View style={styles.notesCard}>
          <Text style={styles.notesLabel}>Default notes</Text>
          <Text style={styles.notesText}>{exercise.default_notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('ExerciseEditor', { exerciseId })}
        >
          <Text style={styles.primaryButtonText}>Edit metadata</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleArchive} disabled={busy}>
          <Text style={styles.secondaryButtonText}>
            {exercise.is_archived ? 'Unarchive' : 'Archive'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MetaRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {String(value)}
      </Text>
    </View>
  );
}

function Badge({ label, tone }) {
  const toneStyle = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    muted: { bg: colors.surface, fg: colors.textSecondary },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.badgeText, { color: toneStyle.fg }]}>{label}</Text>
    </View>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  photoWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  photoPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  badges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  badge: {
    borderRadius: radius.sm * 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  historyLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyLinkSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
  section: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    gap: spacing.md,
  },
  metaLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  notesCard: {
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
});