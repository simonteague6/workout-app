// FinishScreen — post-workout summary (issue #3).
//
// Shows session stats (volume, duration, set/exercise counts) from
// workoutStore.lastSessionStats and, for free-flow sessions, prompts to save
// the session as a reusable routine template. "Done" clears the stats and
// returns to the Workout start screen.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { formatWeight } from '../../utils/formatters.js';
import { colors, radius, spacing } from '../../theme.js';

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function FinishScreen({ navigation }) {
  const stats = useWorkoutStore((s) => s.lastSessionStats);
  const dismissFinished = useWorkoutStore((s) => s.dismissFinished);
  const saveAsTemplate = useWorkoutStore((s) => s.saveAsTemplate);
  const unit = useSettingsStore((s) => s.unit);

  const [templateName, setTemplateName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleDone = () => {
    dismissFinished();
    navigation.popToTop();
  };

  const handleSaveTemplate = async () => {
    if (!stats || !templateName.trim() || saved) return;
    await saveAsTemplate(stats.sessionId, templateName.trim());
    setSaved(true);
  };

  if (!stats) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No session stats.</Text>
        <Pressable onPress={handleDone}>
          <Text style={styles.link}>Back to start</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.cheer}>Workout complete 🎉</Text>

      <View style={styles.statCard}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total volume</Text>
          <Text style={styles.statValue}>{formatWeight(stats.volume, unit)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{formatDuration(stats.durationSeconds)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Exercises</Text>
          <Text style={styles.statValue}>{stats.exerciseCount}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Sets completed</Text>
          <Text style={styles.statValue}>{stats.setCount}</Text>
        </View>
      </View>

      <View style={styles.templateCard}>
        <Text style={styles.templateTitle}>Save as template?</Text>
        <Text style={styles.templateSub}>Reuse this free-flow workout as a routine.</Text>
        <View style={styles.templateRow}>
          <TextInput
            style={styles.nameInput}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
            editable={!saved}
          />
          <Pressable
            style={[styles.saveBtn, (!templateName.trim() || saved) && { opacity: 0.5 }]}
            onPress={handleSaveTemplate}
            disabled={!templateName.trim() || saved}
            android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          >
            <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.doneBtn} onPress={handleDone} android_ripple={{ color: colors.primarySoft }}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  cheer: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  statCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  statLabel: { color: colors.textSecondary, fontSize: 15 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  templateCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  templateTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  templateSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  templateRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    marginRight: spacing.sm,
  },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  doneBtn: { marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  doneBtnText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textSecondary, marginBottom: spacing.md },
  link: { color: colors.primary, fontWeight: '600' },
});