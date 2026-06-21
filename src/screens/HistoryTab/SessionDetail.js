// SessionDetail — shows a completed session's details: date, duration, volume,
// exercises with their sets (weight × reps, set type markers).

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '../../utils/db.js';
import { getSessionDetail } from '../../db/queries/analyticsQueries.js';
import { colors, radius, spacing } from '../../theme.js';

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
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * @param {{ route: { params: { sessionId: number } } }} props
 */
export default function SessionDetail({ route }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);

  useEffect(() => {
    const db = getDatabase();
    const detail = getSessionDetail(db, sessionId);
    setSession(detail);
  }, [sessionId]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Session not found.</Text>
      </View>
    );
  }

  const durationSeconds = session.finished_at
    ? Math.round(
        (new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000,
      )
    : 0;

  // Compute total volume
  let totalVolume = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      if (set.is_completed && set.set_type !== 'warmup' && set.weight != null && set.reps != null) {
        totalVolume += set.weight * set.reps;
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.date}>{formatDate(session.started_at)}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.time}>{formatTime(session.started_at)}</Text>
        {durationSeconds > 0 && (
          <Text style={styles.duration}>{formatDuration(durationSeconds)}</Text>
        )}
        <Text style={styles.volume}>{totalVolume.toLocaleString()} kg total</Text>
      </View>

      {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}

      {/* Exercises */}
      {session.exercises.map((we) => (
        <View key={we.id} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{we.exercise.name}</Text>

          {we.notes ? <Text style={styles.exerciseNotes}>{we.notes}</Text> : null}

          {/* Sets */}
          <View style={styles.setsHeader}>
            <Text style={styles.setsHeaderText}>SET</Text>
            <Text style={styles.setsHeaderText}>WEIGHT</Text>
            <Text style={styles.setsHeaderText}>REPS</Text>
          </View>

          {we.sets.length === 0 ? (
            <Text style={styles.noSets}>No sets recorded</Text>
          ) : (
            we.sets.map((set) => {
              const label = SET_LABELS[set.set_type];
              return (
                <View key={set.id} style={styles.setRow}>
                  <View style={styles.setIndex}>
                    <Text style={styles.setIndexText}>{set.sort_order + 1}</Text>
                    {label && (
                      <View style={[styles.marker, { backgroundColor: label.color }]}>
                        <Text style={styles.markerText}>{label.letter}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.setValue}>
                    {set.weight != null ? set.weight : '-'}
                  </Text>
                  <Text style={styles.setValue}>
                    {set.reps != null ? set.reps : '-'}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      ))}
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
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl * 2,
  },
  date: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  time: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  duration: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  volume: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  notes: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  exerciseNotes: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  setsHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  setsHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  noSets: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  setIndex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setIndexText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  marker: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  markerText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  setValue: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
});
