// StartScreen — Workout tab landing (issue #3).
//
// Offers a Free Flow start (creates an empty WorkoutSession and opens the live
// session) and, when an interrupted/active session exists, a Continue button to
// resume it. On mount it rehydrates any unfinished session from SQLite so a
// restart recovers an in-progress workout.

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useWorkoutStore } from '../../stores/workoutStore.js';
import { colors, radius, spacing } from '../../theme.js';

export default function StartScreen({ navigation }) {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startFreeFlow = useWorkoutStore((s) => s.startFreeFlow);
  const resumeInterrupted = useWorkoutStore((s) => s.resumeInterrupted);

  // Rehydrate an unfinished session after an app restart (no-op when none).
  useEffect(() => {
    resumeInterrupted();
  }, [resumeInterrupted]);

  const handleFreeFlow = async () => {
    await startFreeFlow();
    navigation.navigate('LiveSession');
  };

  const handleContinue = () => navigation.navigate('LiveSession');

  return (
    <View style={styles.container}>
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
        <Text style={[styles.primarySub, activeSession && styles.secondarySubText]}>
          Start an empty workout
        </Text>
      </Pressable>

      <Text style={styles.hint}>Routines (issue #4) will appear here next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
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
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.lg },
});