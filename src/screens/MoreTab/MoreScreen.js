// More tab — Exercise Library, AI & API Keys, Data, Appearance.
// Issue #2 wires the Exercise Library entry point; other sections land in #7.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../theme.js';

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp }} props
 */
export default function MoreScreen({ navigation }) {
  const rows = [
    { label: 'Exercise Library', sub: 'Browse, search, and create exercises', target: 'ExerciseLibrary' },
    { label: 'AI & API Keys', sub: 'Configure your AI provider (issue #7)', target: null },
    { label: 'Data', sub: 'Export & import your data (issue #7)', target: null },
    { label: 'Appearance', sub: 'Theme and units (issue #7)', target: null },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>More</Text>
      <View style={styles.section}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            style={[styles.row, i > 0 && styles.rowBorder]}
            disabled={!row.target}
            onPress={() => row.target && navigation.navigate(row.target)}
            android_ripple={{ color: colors.surface }}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, !row.target && styles.rowLabelDisabled]}>{row.label}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
            </View>
            {row.target ? <Text style={styles.chevron}>›</Text> : null}
          </Pressable>
        ))}
      </View>
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
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  rowLabelDisabled: {
    color: colors.textMuted,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
});