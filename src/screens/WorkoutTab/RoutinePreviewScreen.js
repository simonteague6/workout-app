// RoutinePreviewScreen — routine preview before starting (issue #4).
//
// Shows the routine's exercises with their target sets/reps/rest and the last
// session's performance per exercise (PRD story 31), then a single "Start
// workout" action that pre-loads the routine into a live session. The start
// delegates to workoutStore.startFromRoutine, which sets the active session
// and the LiveSession screen renders it.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useRoutineStore } from '../../stores/routineStore.js';
import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { kgToDisplay } from '../../utils/formatters.js';
import { colors, radius, spacing } from '../../theme.js';

function formatLast(sets, unit) {
  if (!sets || sets.length === 0) return 'No history';
  return sets
    .map((s) => {
      const w = s.weight == null ? '—' : kgToDisplay(s.weight, unit);
      return `${Number.isInteger(w) ? w : w.toFixed(1)}×${s.reps ?? '—'}`;
    })
    .join('  ');
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp,
 *           route: { params: { routineId: number } } }} props
 */
export default function RoutinePreviewScreen({ navigation, route }) {
  const routineId = route.params.routineId;
  const preview = useRoutineStore((s) => s.currentPreview);
  const loadRoutinePreview = useRoutineStore((s) => s.loadRoutinePreview);
  const clearPreview = useRoutineStore((s) => s.clearPreview);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const unit = useSettingsStore((s) => s.unit);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadRoutinePreview(routineId);
    return () => clearPreview();
  }, [loadRoutinePreview, clearPreview, routineId]);

  useEffect(() => {
    if (preview) navigation.setOptions({ title: preview.name });
  }, [navigation, preview]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startFromRoutine(routineId);
      // Replace the preview so back from LiveSession returns to Start, not preview.
      navigation.replace('LiveSession');
    } catch {
      setStarting(false);
    }
  };

  if (!preview) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading routine…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{preview.name}</Text>
          <Text style={styles.sub}>
            {preview.exercises.length} exercise{preview.exercises.length === 1 ? '' : 's'}
          </Text>
        </View>

        {preview.exercises.map((re, i) => (
          <View key={re.id} style={styles.exCard}>
            <View style={styles.exHeader}>
              <Text style={styles.exIndex}>{i + 1}</Text>
              <View style={styles.exTitleWrap}>
                <Text style={styles.exName} numberOfLines={1}>{re.exercise_name}</Text>
                <Text style={styles.exTargets}>
                  {re.target_sets} × {re.target_reps_min}–{re.target_reps_max} · rest {re.target_rest_seconds}s
                </Text>
              </View>
            </View>
            <Text style={styles.lastLabel}>Last session</Text>
            <Text style={styles.lastValue}>
              {re.lastSession ? formatLast(re.lastSession.sets, unit) : 'No history'}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.startBtn, starting && { opacity: 0.6 }]}
          onPress={handleStart}
          disabled={starting}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        >
          <Text style={styles.startBtnText}>{starting ? 'Starting…' : 'Start workout'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  exCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  exIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginRight: spacing.md,
    lineHeight: 26,
  },
  exTitleWrap: { flex: 1 },
  exName: { fontSize: 16, fontWeight: '600', color: colors.text },
  exTargets: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  lastLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  lastValue: { fontSize: 14, color: colors.text, marginTop: 2 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  startBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  empty: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});