// History tab — calendar of past sessions (issue #6). Issue #2 adds the
// "Browse exercises" entry point so the Exercise Library is reachable from the
// History tab too (PRD §Navigation: exercise list accessible from both tabs).
// Per-exercise history search lands in #6 and reuses ExerciseHistoryScreen.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../theme.js';

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp }} props
 */
export default function CalendarScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>History</Text>

      <Pressable
        style={styles.browseButton}
        onPress={() => navigation.navigate('ExerciseLibrary')}
        android_ripple={{ color: colors.primarySoft }}
      >
        <View style={styles.browseText}>
          <Text style={styles.browseTitle}>Browse exercises</Text>
          <Text style={styles.browseSub}>Search the library and view an exercise's history</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.placeholder}>
        Calendar of past workouts. (issue #6)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  browseText: {
    flex: 1,
  },
  browseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  browseSub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
  placeholder: {
    marginTop: spacing.xl,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});