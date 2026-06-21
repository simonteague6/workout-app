// Progress tab — 1RM charts, volume trends, heatmap, muscle-group frequency, PRs.

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '../../utils/db.js';
import {
  getAllTime1RMs,
  getRecent1RMs,
  getWeeklyVolumeByMuscleGroup,
  getHeatmapData,
  getMuscleGroupFrequency,
} from '../../db/queries/analyticsQueries.js';
import CalendarHeatmap from '../../components/CalendarHeatmap.js';
import { colors, radius, spacing } from '../../theme.js';

const BAR_MAX_WIDTH = 200;
const BAR_HEIGHT = 16;
const BAR_GAP = 4;

export default function ProgressScreen() {
  const [allTimePRs, setAllTimePRs] = useState([]);
  const [recentPRs, setRecentPRs] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [muscleFreq, setMuscleFreq] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    setAllTimePRs(getAllTime1RMs(db));
    setRecentPRs(getRecent1RMs(db));
    setVolumeData(getWeeklyVolumeByMuscleGroup(db));
    setHeatmapData(getHeatmapData(db));
    setMuscleFreq(getMuscleGroupFrequency(db));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Progress</Text>

      {/* All-time PRs */}
      <Section title="All-Time Personal Records">
        {allTimePRs.length === 0 ? (
          <Text style={styles.emptyText}>Complete some workouts to see your PRs.</Text>
        ) : (
          allTimePRs.slice(0, 10).map((pr) => (
            <View key={pr.exerciseId} style={styles.prRow}>
              <Text style={styles.prName}>{pr.exerciseName}</Text>
              <Text style={styles.prValue}>{Math.round(pr.estimated1RM)} kg</Text>
            </View>
          ))
        )}
      </Section>

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <Section title="Recent PRs (Last 30 Days)">
          {recentPRs.map((pr) => (
            <View key={pr.exerciseId} style={styles.prRow}>
              <Text style={styles.prName}>{pr.exerciseName}</Text>
              <Text style={styles.prValueRecent}>{Math.round(pr.estimated1RM)} kg</Text>
            </View>
          ))}
        </Section>
      )}

      {/* Weekly volume trend */}
      <Section title="Weekly Volume by Muscle Group">
        {volumeData.length === 0 ? (
          <Text style={styles.emptyText}>No volume data yet.</Text>
        ) : (
          renderVolumeChart(volumeData)
        )}
      </Section>

      {/* Calendar heatmap */}
      <Section title="Workout Frequency">
        {heatmapData.length === 0 ? (
          <Text style={styles.emptyText}>No workout data yet.</Text>
        ) : (
          <CalendarHeatmap data={heatmapData} />
        )}
      </Section>

      {/* Muscle group frequency */}
      <Section title="Most Trained Muscle Groups">
        {muscleFreq.length === 0 ? (
          <Text style={styles.emptyText}>No data yet.</Text>
        ) : (
          renderMuscleFreqChart(muscleFreq)
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function renderVolumeChart(data) {
  // Group by muscle group, show last 12 weeks
  const muscleGroups = [...new Set(data.map((d) => d.muscleGroup))];
  const maxVolume = Math.max(...data.map((d) => d.totalVolume), 1);

  return muscleGroups.map((mg) => {
    const weeks = data.filter((d) => d.muscleGroup === mg);
    const total = weeks.reduce((sum, w) => sum + w.totalVolume, 0);
    const barWidth = Math.max(4, (total / maxVolume) * BAR_MAX_WIDTH);

    return (
      <View key={mg} style={styles.volumeRow}>
        <Text style={styles.volumeLabel}>{mg}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.bar, { width: barWidth }]} />
        </View>
        <Text style={styles.volumeValue}>{total.toLocaleString()} kg</Text>
      </View>
    );
  });
}

function renderMuscleFreqChart(data) {
  const maxCount = Math.max(...data.map((d) => d.sessionCount), 1);

  return data.slice(0, 8).map((f) => {
    const barWidth = Math.max(4, (f.sessionCount / maxCount) * BAR_MAX_WIDTH);

    return (
      <View key={f.muscleGroup} style={styles.volumeRow}>
        <Text style={styles.volumeLabel}>{f.muscleGroup}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.freqBar, { width: barWidth }]} />
        </View>
        <Text style={styles.volumeValue}>{f.sessionCount} sessions</Text>
      </View>
    );
  });
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
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  prValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  prValueRecent: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: BAR_GAP,
  },
  volumeLabel: {
    width: 80,
    fontSize: 12,
    color: colors.text,
  },
  barTrack: {
    flex: 1,
    height: BAR_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  freqBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: radius.sm,
  },
  volumeValue: {
    width: 80,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
  },
});
