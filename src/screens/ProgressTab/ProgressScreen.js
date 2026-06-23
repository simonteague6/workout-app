// Progress tab — 1RM charts, volume trends, heatmap, muscle-group frequency, PRs.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAnalyticsStore } from '../../stores/analyticsStore.js';
import CalendarHeatmap from '../../components/CalendarHeatmap.js';
import { colors, radius, spacing } from '../../theme.js';

const BAR_MAX_WIDTH = 200;
const BAR_HEIGHT = 16;
const BAR_GAP = 4;

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const allTimePRs = useAnalyticsStore((s) => s.allTimePRs);
  const recentPRs = useAnalyticsStore((s) => s.recentPRs);
  const volumeData = useAnalyticsStore((s) => s.volumeData);
  const heatmapData = useAnalyticsStore((s) => s.heatmapData);
  const muscleFreq = useAnalyticsStore((s) => s.muscleFreq);
  const isLoading = useAnalyticsStore((s) => s.isLoading);
  const loadProgressData = useAnalyticsStore((s) => s.loadProgressData);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
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
  const maxVolume = Math.max(...data.map((d) => d.total_volume), 1);
  return data.map((week, i) => (
    <View key={`vol-${week.week_start}-${i}`} style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>
        {week.muscle_group}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: Math.max((week.total_volume / maxVolume) * BAR_MAX_WIDTH, 2) },
          ]}
        />
      </View>
      <Text style={styles.barValue}>{Math.round(week.total_volume)} kg</Text>
    </View>
  ));
}

function renderMuscleFreqChart(data) {
  const maxCount = Math.max(...data.map((d) => d.session_count), 1);
  return data.map((item, i) => (
    <View key={`freq-${item.muscle_group}-${i}`} style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>
        {item.muscle_group}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: Math.max((item.session_count / maxCount) * BAR_MAX_WIDTH, 2) },
          ]}
        />
      </View>
      <Text style={styles.barValue}>{item.session_count} sessions</Text>
    </View>
  ));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  prName: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  prValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  prValueRecent: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: BAR_GAP,
  },
  barLabel: {
    width: 100,
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: BAR_HEIGHT,
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: BAR_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  barValue: {
    width: 70,
    fontSize: 12,
    color: colors.text,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
