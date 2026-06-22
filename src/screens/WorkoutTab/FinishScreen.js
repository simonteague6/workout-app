// FinishScreen — post-workout summary (issues #3 + #4).
//
// Two paths share this screen:
//   * Free-flow sessions (routine_id = null): stats + "save as template" prompt.
//   * Routine-driven sessions: stats + a git-diff-style comparison of the
//     planned routine vs. what actually happened (matched / substituted /
//     skipped / added, shown as colored status dots with labels), then three
//     options — Update template, Keep original, Save as new (PRD 25–26).
// "Done" clears the stats and returns to the Workout start screen.
//
// No emojis: the header is an animated stat-reveal, diff markers are colored
// dots + text labels, and confirmations use a lucide check icon. Stat cards
// reveal in sequence with a staggered spring.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';

import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useRoutineStore } from '../../stores/routineStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { getDatabase } from '../../utils/db.js';
import { getRoutineSessionDiff } from '../../db/queries/routineQueries.js';
import { formatWeight } from '../../utils/formatters.js';
import { useAppTheme, spacing, radius, elevation } from '../../theme/index.js';
import { cardEnterSpring, staggerDelay } from '../../utils/animation.js';
import Icon from '../../components/Icon.js';

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Diff type → colored dot tone + text label (replaces the old emoji glyphs).
const DIFF_META = {
  matched: { tone: 'textMuted', label: 'Matched' },
  substituted: { tone: 'accent', label: 'Substituted' },
  skipped: { tone: 'danger', label: 'Skipped' },
  added: { tone: 'warning', label: 'Added' },
};

/** Staggered reveal: fade + rise, delayed by index. */
function useReveal(delay) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(1, cardEnterSpring));
  }, [v, delay]);
  return useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 14 }],
  }));
}

function StatCard({ icon, label, value, delay, colors, elev }) {
  const reveal = useReveal(delay);
  return (
    <Animated.View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, ...elev.card }, reveal]}>
      <View style={[styles.statIconWrap, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={18} color={colors.accent} strokeWidth={2.5} />
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </Animated.View>
  );
}

export default function FinishScreen({ navigation }) {
  const { colors, elevation: elev } = useAppTheme();
  const stats = useWorkoutStore((s) => s.lastSessionStats);
  const dismissFinished = useWorkoutStore((s) => s.dismissFinished);
  const saveAsTemplate = useWorkoutStore((s) => s.saveAsTemplate);
  const unit = useSettingsStore((s) => s.unit);

  const folders = useRoutineStore((s) => s.folders);
  const loadFolders = useRoutineStore((s) => s.loadFolders);
  const saveAsNewFromDiff = useRoutineStore((s) => s.saveAsNewFromDiff);
  const updateTemplateFromSession = useRoutineStore((s) => s.updateTemplateFromSession);

  const [templateName, setTemplateName] = useState('');
  const [saved, setSaved] = useState(false);
  const [newName, setNewName] = useState('');
  const [actionTaken, setActionTaken] = useState(null);

  const headerReveal = useReveal(0);

  const isRoutine = stats?.routineId != null;

  const diff = useMemo(
    () => (stats && isRoutine ? getRoutineSessionDiff(getDatabase(), stats.routineId, stats.sessionId) : []),
    [stats, isRoutine],
  );
  const originalFolderId = useMemo(() => {
    if (!stats || !isRoutine) return null;
    const row = getDatabase().execute(`SELECT folder_id FROM routine WHERE id = ?`, [stats.routineId]).rows[0];
    return row?.folder_id ?? null;
  }, [stats, isRoutine]);
  const [newFolderId, setNewFolderId] = useState(originalFolderId);

  useEffect(() => {
    if (stats && isRoutine) loadFolders();
  }, [stats, isRoutine, loadFolders]);

  const handleDone = () => {
    dismissFinished();
    navigation.popToTop();
  };

  const handleSaveTemplate = async () => {
    if (!stats || !templateName.trim() || saved) return;
    await saveAsTemplate(stats.sessionId, templateName.trim());
    setSaved(true);
  };

  const handleUpdateTemplate = async () => {
    if (!stats || actionTaken) return;
    await updateTemplateFromSession(stats.routineId, stats.sessionId);
    setActionTaken('updated');
  };

  const handleKeep = () => setActionTaken('kept');

  const handleSaveAsNew = async () => {
    if (!stats || !newName.trim() || actionTaken === 'savedNew') return;
    await saveAsNewFromDiff(stats.sessionId, newName.trim(), newFolderId);
    setActionTaken('savedNew');
  };

  if (!stats) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No session stats.</Text>
        <Pressable onPress={handleDone}>
          <Text style={[styles.link, { color: colors.accent }]}>Back to start</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Animated.View style={[styles.header, headerReveal]}>
        <View style={[styles.headerIcon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="check-circle-big" size={34} color={colors.accent} strokeWidth={2.2} />
        </View>
        <Text style={[styles.cheer, { color: colors.text }]}>Workout complete</Text>
      </Animated.View>

      <View style={styles.statGrid}>
        <StatCard icon="weight" label="Volume" value={formatWeight(stats.volume, unit)} delay={staggerDelay} colors={colors} elev={elev} />
        <StatCard icon="clock" label="Duration" value={formatDuration(stats.durationSeconds)} delay={staggerDelay * 2} colors={colors} elev={elev} />
        <StatCard icon="dumbbell" label="Exercises" value={String(stats.exerciseCount)} delay={staggerDelay * 3} colors={colors} elev={elev} />
        <StatCard icon="hash" label="Sets" value={String(stats.setCount)} delay={staggerDelay * 4} colors={colors} elev={elev} />
      </View>

      {isRoutine ? (
        <RoutineDiffSection
          diff={diff}
          folders={folders}
          newName={newName}
          setNewName={setNewName}
          newFolderId={newFolderId}
          setNewFolderId={setNewFolderId}
          actionTaken={actionTaken}
          onUpdate={handleUpdateTemplate}
          onKeep={handleKeep}
          onSaveAsNew={handleSaveAsNew}
          colors={colors}
          elev={elev}
        />
      ) : (
        <View style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }, elev.card]}>
          <Text style={[styles.templateTitle, { color: colors.text }]}>Save as template?</Text>
          <Text style={[styles.templateSub, { color: colors.textSecondary }]}>Reuse this free-flow workout as a routine.</Text>
          <View style={styles.templateRow}>
            <TextInput
              style={[styles.nameInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Workout name"
              placeholderTextColor={colors.textMuted}
              editable={!saved}
            />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.accent }, (!templateName.trim() || saved) && { opacity: 0.5 }]}
              onPress={handleSaveTemplate}
              disabled={!templateName.trim() || saved}
              android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
            >
              <Text style={styles.saveBtnText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Pressable
        style={[styles.doneBtn, { backgroundColor: colors.accent }]}
        onPress={handleDone}
        android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

function RoutineDiffSection({
  diff,
  folders,
  newName,
  setNewName,
  newFolderId,
  setNewFolderId,
  actionTaken,
  onUpdate,
  onKeep,
  onSaveAsNew,
  colors,
  elev,
}) {
  const acted = actionTaken != null;
  return (
    <View style={[styles.diffCard, { backgroundColor: colors.card, borderColor: colors.border }, elev.card]}>
      <Text style={[styles.diffTitle, { color: colors.text }]}>Routine vs. today</Text>
      {diff.length === 0 ? (
        <Text style={[styles.diffEmpty, { color: colors.textMuted }]}>No comparison available.</Text>
      ) : (
        diff.map((d, i) => {
          const meta = DIFF_META[d.type];
          const dotColor = colors[meta.tone];
          return (
            <View key={i} style={[styles.diffRow, { borderColor: colors.border }]}>
              <View style={[styles.diffRail, { backgroundColor: dotColor }]} />
              <View style={[styles.diffDot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.diffName, { color: colors.text }, d.type === 'substituted' && { textDecorationLine: 'line-through' }]}
                  numberOfLines={1}
                >
                  {d.type === 'added' ? d.exerciseName : d.routineExerciseName}
                </Text>
                <Text style={[styles.diffSub, { color: colors.textSecondary }]}>
                  {meta.label}
                  {d.type === 'substituted' ? ` → ${d.substituteExerciseName}` : ''}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <Text style={[styles.optionsTitle, { color: colors.text }]}>Update the routine?</Text>
      {acted ? (
        <View style={[styles.actedNote, { backgroundColor: colors.accentSoft }]}>
          <Icon name="check-circle" size={18} color={colors.accent} strokeWidth={2.2} />
          <Text style={[styles.actedText, { color: colors.accent }]}>
            {actionTaken === 'updated'
              ? 'Template updated to today\u2019s workout'
              : actionTaken === 'kept'
                ? 'Routine kept as-is'
                : 'Saved as a new routine'}
          </Text>
        </View>
      ) : (
        <View style={styles.optionsRow}>
          <Pressable
            style={[styles.optionBtn, styles.optionPrimary, { backgroundColor: colors.accent }]}
            onPress={onUpdate}
            android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
          >
            <Text style={styles.optionPrimaryText}>Update template</Text>
          </Pressable>
          <Pressable
            style={[styles.optionBtn, styles.optionSecondary, { borderColor: colors.accent }]}
            onPress={onKeep}
            android_ripple={{ color: colors.accentSoft }}
          >
            <Text style={[styles.optionSecondaryText, { color: colors.accent }]}>Keep original</Text>
          </Pressable>
        </View>
      )}

      <Text style={[styles.saveAsNewTitle, { color: colors.text }]}>Save as new</Text>
      <View style={styles.templateRow}>
        <TextInput
          style={[styles.nameInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          value={newName}
          onChangeText={setNewName}
          placeholder="New routine name"
          placeholderTextColor={colors.textMuted}
          editable={actionTaken !== 'savedNew'}
        />
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.accent }, (!newName.trim() || actionTaken === 'savedNew') && { opacity: 0.5 }]}
          onPress={onSaveAsNew}
          disabled={!newName.trim() || actionTaken === 'savedNew'}
          android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
        >
          <Text style={styles.saveBtnText}>{actionTaken === 'savedNew' ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [styles.folderBtn, pressed && { opacity: 0.6 }]}
        onPress={() => setNewFolderId(newFolderId == null ? folders[0]?.id ?? null : null)}
      >
        <Icon name="folder" size={14} color={colors.accent} strokeWidth={2.2} />
        <Text style={[styles.folderBtnText, { color: colors.accent }]}>
          Folder: {folders.find((f) => f.id === newFolderId)?.name ?? 'Unfiled'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, paddingTop: spacing.md },
  headerIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  cheer: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  statIconWrap: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  statLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  statValue: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  templateCard: { marginTop: spacing.lg, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  templateTitle: { fontSize: 17, fontWeight: '800' },
  templateSub: { fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: spacing.md },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  saveBtnText: { color: '#06251A', fontWeight: '800' },
  doneBtn: { marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  doneBtnText: { color: '#06251A', fontWeight: '800', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { fontSize: 16, fontWeight: '600' },
  link: { fontWeight: '700' },
  diffCard: { marginTop: spacing.lg, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  diffTitle: { fontSize: 17, fontWeight: '800', marginBottom: spacing.md },
  diffEmpty: { fontSize: 14, fontWeight: '600' },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    marginBottom: 6,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  diffRail: { alignSelf: 'stretch', width: 3, borderRadius: 2, marginRight: 2 },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffName: { fontSize: 15, fontWeight: '700' },
  diffSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  optionsTitle: { fontSize: 15, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm },
  optionsRow: { flexDirection: 'row', gap: spacing.sm },
  optionBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  optionPrimary: {},
  optionPrimaryText: { color: '#06251A', fontWeight: '800' },
  optionSecondary: { borderWidth: 1 },
  optionSecondaryText: { fontWeight: '800' },
  actedNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md },
  actedText: { fontSize: 14, fontWeight: '700' },
  saveAsNewTitle: { fontSize: 14, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm },
  folderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'flex-start' },
  folderBtnText: { fontSize: 13, fontWeight: '700' },
});