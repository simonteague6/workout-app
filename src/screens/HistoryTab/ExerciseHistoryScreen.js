// ExerciseHistoryScreen — per-exercise history (the detail card's history-link
// target, PRD story 47). Shows every session that used the exercise,
// chronologically newest-first, with each set's weight × reps and set-type
// markers. Lives in HistoryTab per the AGENTS.md layout; it is reused by the
// History tab's own search entry in issue #6.

import { useSettingsStore } from '../../stores/settingsStore.js';
import { kgToDisplay, displayNumber } from '../../utils/formatters.js';
import { colors, radius, spacing } from '../../theme.js';
import { useExerciseStore } from '../../stores/exerciseStore.js';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
const SET_LABELS = {
  normal: null,
  warmup: { letter: 'W', color: colors.warning },
  dropset: { letter: 'D', color: colors.primary },
  failure: { letter: 'F', color: colors.danger },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @param {{ route: { params: { exerciseId: number, exerciseName?: string } } }} props
 */
export default function ExerciseHistoryScreen({ route }) {
  const { exerciseId, exerciseName } = route.params;
  const history = useExerciseStore((s) => s.currentHistory);
  const loadHistory = useExerciseStore((s) => s.loadHistory);
  const unit = useSettingsStore((s) => s.unit);

  useEffect(() => {
    loadHistory(exerciseId);
  }, [loadHistory, exerciseId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No workouts logged yet</Text>
          <Text style={styles.emptySubtitle}>
            {exerciseName ? `${exerciseName} ` : ''}will appear here after you log it in a workout.
          </Text>
        </View>
      ) : (
        history.map((session) => (
          <View key={session.session_id} style={styles.sessionCard}>
            <Text style={styles.sessionDate}>{formatDate(session.started_at)}</Text>
            {session.exercise_notes ? (
              <Text style={styles.sessionNotes}>{session.exercise_notes}</Text>
            ) : null}
            <View style={styles.setsHeader}>
              <Text style={styles.setsHeaderText}>Sets</Text>
            </View>
            {session.sets.length === 0 ? (
              <Text style={styles.noSets}>No sets recorded.</Text>
            ) : (
              session.sets.map((set, i) => {
                const marker = SET_LABELS[set.set_type];
                return (
                  <View key={set.id ?? i} style={styles.setRow}>
                    <Text style={styles.setIndex}>{i + 1}</Text>
                    <Text style={styles.setDetail}>
                      {set.weight != null ? `${displayNumber(kgToDisplay(set.weight, unit))} ${unit}` : '—'}
                      <Text style={styles.setUnit}> × </Text>
                      {set.reps != null ? `${set.reps}` : '—'} reps
                    </Text>
                    {marker ? (
                      <View style={[styles.marker, { backgroundColor: marker.color }]}>
                        <Text style={styles.markerText}>{marker.letter}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        ))
      )}
    </ScrollView>
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
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sessionNotes: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  setsHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  setsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noSets: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 1,
  },
  setIndex: {
    width: 24,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  setDetail: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  setUnit: {
    color: colors.textMuted,
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});