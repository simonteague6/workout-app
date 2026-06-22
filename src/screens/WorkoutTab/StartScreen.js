// StartScreen — Workout tab landing (issues #3 + #4).
//
// Offers a Free Flow start, a Continue button when an interrupted/active
// session exists, and the Routines section: routines grouped by folder with a
// pencil-icon edit affordance (PRD story 33) and a tap-to-preview path (PRD
// story 31). "New routine" opens the routine builder. On mount it rehydrates
// any unfinished session and loads folders + routines.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useWorkoutStore } from '../../stores/workoutStore.js';
import { useRoutineStore } from '../../stores/routineStore.js';
import { useAppTheme, spacing, radius, elevation } from '../../theme/index.js';
import Icon from '../../components/Icon.js';

export default function StartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, elevation: elev } = useAppTheme();
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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Workout</Text>

      {activeSession ? (
        <Pressable
          style={[styles.continueBtn, { backgroundColor: colors.accent }, elev.card]}
          onPress={handleContinue}
          android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
        >
          <View style={styles.continueLeft}>
            <Text style={styles.continueBtnText}>Continue workout</Text>
            <Text style={styles.continueSub}>
              {activeSession.exercises.length} exercise{activeSession.exercises.length === 1 ? '' : 's'} in progress
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color="#06251A" strokeWidth={2.5} />
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.freeFlow, activeSession ? { borderColor: colors.accent } : { backgroundColor: colors.card, ...elev.card }]}
        onPress={handleFreeFlow}
        android_ripple={{ color: colors.accentSoft }}
      >
        <View style={styles.freeFlowLeft}>
          <Icon
            name="zap"
            size={20}
            color={activeSession ? colors.accent : colors.accent}
            strokeWidth={2.5}
          />
          <View>
            <Text style={[styles.freeFlowText, { color: activeSession ? colors.accent : colors.text }]}>Free Flow</Text>
            <Text style={[styles.freeFlowSub, { color: activeSession ? colors.textSecondary : colors.textMuted }]}>
              Start an empty workout
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Routines</Text>
        <Pressable
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.navigate('RoutineBuilder')}
          hitSlop={8}
        >
          <Icon name="plus" size={16} color={colors.accent} strokeWidth={2.5} />
          <Text style={[styles.newBtnText, { color: colors.accent }]}>New</Text>
        </Pressable>
      </View>

      {!hasRoutines ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }, elev.card]}>
          <Icon name="list-plus" size={26} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No routines yet. Create one to pre-load exercises and target sets.
          </Text>
        </View>
      ) : (
        grouped.map((group, gi) => (
          <View key={`${group.folderName}-${gi}`} style={styles.group}>
            <Text style={[styles.folderLabel, { color: colors.textMuted }]}>{group.folderName}</Text>
            {group.routines.map((r) => (
              <Pressable
                key={r.id}
                style={({ pressed }) => [
                  styles.routineRow,
                  { backgroundColor: colors.card, borderColor: colors.border, ...elev.card },
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => navigation.navigate('RoutinePreview', { routineId: r.id })}
                android_ripple={{ color: colors.accentSoft }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routineName, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[styles.routineSub, { color: colors.textMuted }]}>
                    {r.exercise_count} exercise{r.exercise_count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Pressable
                  hitSlop={12}
                  onPress={() => navigation.navigate('RoutineBuilder', { routineId: r.id })}
                  style={styles.editBtn}
                >
                  <Icon name="pencil" size={17} color={colors.textSecondary} strokeWidth={2} />
                </Pressable>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: spacing.xl },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  continueLeft: { flex: 1 },
  continueBtnText: { color: '#06251A', fontSize: 18, fontWeight: '800' },
  continueSub: { color: 'rgba(6,37,26,0.7)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  freeFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  freeFlowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  freeFlowText: { fontSize: 18, fontWeight: '800' },
  freeFlowSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm },
  newBtnText: { fontSize: 15, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  group: { marginBottom: spacing.lg },
  folderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  routineName: { fontSize: 16, fontWeight: '700' },
  routineSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  editBtn: { paddingHorizontal: spacing.sm },
});