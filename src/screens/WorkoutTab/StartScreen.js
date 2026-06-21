// StartScreen — Workout tab landing (issues #3 + #4).
//
// Offers a Free Flow start, a Continue button when an interrupted/active
// session exists, and the Routines section: routines grouped by folder with
// a pencil-icon edit affordance (PRD story 33) and a tap-to-preview path
// (PRD story 31). "New routine" opens the routine builder. On mount it
// rehydrates any unfinished session and loads folders + routines.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useRoutineStore } from '../../stores/routineStore.js';
import { colors, radius, spacing } from '../../theme.js';
export default function StartScreen({ navigation }) {

  const insets = useSafeAreaInsets();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startFreeFlow = useWorkoutStore((s) => s.startFreeFlow);
  const resumeInterrupted = useWorkoutStore((s) => s.resumeInterrupted);

  const folders = useRoutineStore((s) => s.folders);
  const routines = useRoutineStore((s) => s.routines);
  const loadFolders = useRoutineStore((s) => s.loadFolders);
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);

  useEffect(() => {
    resumeInterrupted();
    loadFolders();
    loadRoutines();
  }, [resumeInterrupted, loadFolders, loadRoutines]);

  const handleFreeFlow = async () => {
    await startFreeFlow();
    navigation.navigate('LiveSession');
  };

  const handleContinue = () => navigation.navigate('LiveSession');

  // Group routines by folder (null folder = "Unfiled"), preserving folder order.
  const grouped = folders.map((f) => ({
    folderName: f.name,
    routines: routines.filter((r) => r.folder_id === f.id),
  }));
  const unfiled = routines.filter((r) => r.folder_id == null);
  if (unfiled.length) grouped.push({ folderName: 'Unfiled', routines: unfiled });
  const hasRoutines = routines.length > 0;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workout</Text>

      {activeSession ? (
        <Pressable style={styles.primaryBtn} onPress={handleContinue} android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
          <Text style={styles.primaryBtnText}>Continue workout</Text>
          <Text style={styles.primarySub}>
            {activeSession.exercises.length} exercise{activeSession.exercises.length === 1 ? '' : 's'} in progress
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.primaryBtn, activeSession && styles.secondaryBtn]}
        onPress={handleFreeFlow}
        android_ripple={{ color: colors.primarySoft }}
      >
        <Text style={[styles.primaryBtnText, activeSession && styles.secondaryBtnText]}>Free Flow</Text>
        <Text style={[styles.primarySub, activeSession && styles.secondarySubText]}>Start an empty workout</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Routines</Text>
        <Pressable
          onPress={() => navigation.navigate('RoutineBuilder')}
          hitSlop={8}
          android_ripple={{ color: colors.primarySoft, radius: 24, foreground: true }}
        >
          <Text style={styles.newBtn}>＋ New</Text>
        </Pressable>
      </View>

      {!hasRoutines ? (
        <Text style={styles.empty}>No routines yet. Create one to pre-load exercises and target sets.</Text>
      ) : (
        grouped.map((group, gi) => (
          <View key={`${group.folderName}-${gi}`} style={styles.group}>
            <Text style={styles.folderLabel}>{group.folderName}</Text>
            {group.routines.map((r) => (
              <Pressable
                key={r.id}
                style={styles.routineRow}
                onPress={() => navigation.navigate('RoutinePreview', { routineId: r.id })}
                android_ripple={{ color: colors.primarySoft }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.routineName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.routineSub}>
                    {r.exercise_count} exercise{r.exercise_count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => navigation.navigate('RoutineBuilder', { routineId: r.id })}
                  android_ripple={{ color: colors.primarySoft, radius: 20, foreground: true }}
                >
                  <Text style={styles.editIcon}>✎</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  primarySub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  secondaryBtnText: { color: colors.primary },
  secondarySubText: { color: colors.textSecondary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  newBtn: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14 },
  group: { marginBottom: spacing.lg },
  folderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  routineName: { fontSize: 16, fontWeight: '600', color: colors.text },
  routineSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  editIcon: { fontSize: 18, color: colors.primary, paddingHorizontal: spacing.sm },
});