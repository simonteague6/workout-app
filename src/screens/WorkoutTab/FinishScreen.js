// FinishScreen — post-workout summary (issues #3 + #4).
//
// Two paths share this screen:
//   * Free-flow sessions (routine_id = null): stats + "save as template" prompt.
//   * Routine-driven sessions (routine_id set): stats + a git-diff-style
//     comparison of the planned routine vs. what actually happened (matched ✓,
//     substituted 🟢, skipped 🔴, added), then three options — Update template,
//     Keep original, Save as new (PRD stories 25–26).
// "Done" clears the stats and returns to the Workout start screen.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useRoutineStore } from '../../stores/routineStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { getDatabase } from '../../utils/db.js';
import { getRoutineSessionDiff } from '../../db/queries/routineQueries.js';
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

const DIFF_META = {
  matched: { glyph: '✓', color: colors.textSecondary, bg: colors.surface },
  substituted: { glyph: '🟢', color: colors.success, bg: colors.successSoft },
  skipped: { glyph: '🔴', color: colors.danger, bg: colors.dangerSoft },
  added: { glyph: '+', color: colors.primary, bg: colors.primarySoft },
};

export default function FinishScreen({ navigation }) {
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
  const [actionTaken, setActionTaken] = useState(null); // 'updated' | 'kept' | 'savedNew'

  const isRoutine = stats?.routineId != null;

  // The finish diff + the original routine's folder (to pre-fill Save As New)
  // are derived synchronously from SQLite; no component setState needed.
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

  // Load folders for the Save As New folder picker (store action, not setState).
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
        />
      ) : (
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
      )}

      <Pressable style={styles.doneBtn} onPress={handleDone} android_ripple={{ color: colors.primarySoft }}>
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
}) {
  const acted = actionTaken != null;
  return (
    <View style={styles.diffCard}>
      <Text style={styles.diffTitle}>Routine vs. today</Text>
      {diff.length === 0 ? (
        <Text style={styles.diffEmpty}>No comparison available.</Text>
      ) : (
        diff.map((d, i) => {
          const meta = DIFF_META[d.type];
          return (
            <View key={i} style={[styles.diffRow, { backgroundColor: meta.bg }]}>
              <Text style={styles.diffGlyph}>{meta.glyph}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.diffName} numberOfLines={1}>
                  {d.type === 'added' ? d.exerciseName : d.routineExerciseName}
                </Text>
                {d.type === 'substituted' ? (
                  <Text style={styles.diffSub}>→ {d.substituteExerciseName}</Text>
                ) : null}
                {d.type === 'skipped' ? <Text style={styles.diffSub}>Skipped today</Text> : null}
                {d.type === 'added' ? <Text style={styles.diffSub}>Added today</Text> : null}
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.optionsTitle}>Update the routine?</Text>
      {acted ? (
        <Text style={styles.actedNote}>
          {actionTaken === 'updated'
            ? 'Template updated to today\u2019s workout ✓'
            : actionTaken === 'kept'
              ? 'Routine kept as-is ✓'
              : 'Saved as a new routine ✓'}
        </Text>
      ) : (
        <View style={styles.optionsRow}>
          <Pressable style={[styles.optionBtn, styles.optionPrimary]} onPress={onUpdate} android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
            <Text style={styles.optionPrimaryText}>Update template</Text>
          </Pressable>
          <Pressable style={[styles.optionBtn, styles.optionSecondary]} onPress={onKeep} android_ripple={{ color: colors.primarySoft }}>
            <Text style={styles.optionSecondaryText}>Keep original</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.saveAsNewTitle}>Save as new</Text>
      <View style={styles.templateRow}>
        <TextInput
          style={styles.nameInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="New routine name"
          placeholderTextColor={colors.textMuted}
          editable={actionTaken !== 'savedNew'}
        />
        <Pressable
          style={[styles.saveBtn, (!newName.trim() || actionTaken === 'savedNew') && { opacity: 0.5 }]}
          onPress={onSaveAsNew}
          disabled={!newName.trim() || actionTaken === 'savedNew'}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        >
          <Text style={styles.saveBtnText}>{actionTaken === 'savedNew' ? 'Saved ✓' : 'Save'}</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.folderBtn}
        onPress={() => setNewFolderId(newFolderId == null ? folders[0]?.id ?? null : null)}
      >
        <Text style={styles.folderBtnText}>
          Folder: {folders.find((f) => f.id === newFolderId)?.name ?? 'Unfiled'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
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
  diffCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  diffTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  diffEmpty: { color: colors.textMuted, fontSize: 14 },
  diffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, marginBottom: 6 },
  diffGlyph: { fontSize: 14, marginRight: spacing.md },
  diffName: { fontSize: 15, fontWeight: '600', color: colors.text },
  diffSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  optionsTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  optionsRow: { flexDirection: 'row', gap: spacing.sm },
  optionBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  optionPrimary: { backgroundColor: colors.primary },
  optionPrimaryText: { color: '#fff', fontWeight: '700' },
  optionSecondary: { borderWidth: 1, borderColor: colors.primary },
  optionSecondaryText: { color: colors.primary, fontWeight: '700' },
  actedNote: { color: colors.success, fontSize: 14, fontWeight: '600' },
  saveAsNewTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  folderBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  folderBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});