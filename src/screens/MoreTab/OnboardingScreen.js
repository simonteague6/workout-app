// OnboardingScreen — two-screen onboarding flow.
// Screen 1: Welcome with app description and "Get started" button.
// Screen 2: "How to begin?" with three options: Start Free Flow,
// Import from URL (pre-loaded demo URLs), Browse Exercises.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useSettingsStore } from '../../stores/settingsStore.js';
import { getDatabase } from '../../utils/db.js';
import { importRoutine } from '../../ai/routineImport.js';
import { colors, spacing, radius } from '../../theme.js';

// Demo URLs the user can tap to try the import feature
const DEMO_URLS = [
  { label: 'StrongLifts 5x5', url: 'https://stronglifts.com/5x5/' },
  { label: 'Push/Pull/Legs split', url: 'https://www.muscleandstrength.com/workouts/push-pull-legs-split.html' },
  { label: 'Starting Strength', url: 'https://startingstrength.com/get-started' },
];

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { ai } = useSettingsStore();
  const [step, setStep] = useState(1);
  const [importing, setImporting] = useState(false);

  function handleGetStarted() {
    setStep(2);
  }

  function handleStartFreeFlow() {
    navigation.navigate('WorkoutTab', { screen: 'LiveSession' });
  }

  function handleBrowseExercises() {
    navigation.navigate('MoreTab', { screen: 'ExerciseLibrary' });
  }

  async function handleDemoImport(url) {
    if (!ai.apiKey) {
      Alert.alert(
        'API key required',
        'To use AI import, configure your API key in Settings > AI & API Keys. ' +
        'You can also browse exercises or start a free flow workout.',
      );
      return;
    }

    setImporting(true);
    try {
      const db = getDatabase();
      const result = await importRoutine(db, ai, url);
      navigation.navigate('MoreTab', {
        screen: 'ImportReview',
        params: { importResult: result },
      });
    } catch (err) {
      Alert.alert('Import failed', err.message);
    } finally {
      setImporting(false);
    }
  }

  if (step === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.appName}>Oh My Pi</Text>
          <Text style={styles.tagline}>Your personal workout companion</Text>
        </View>

        <View style={styles.features}>
          <FeatureItem
            icon="\uD83D\uDCCB"
            title="Track workouts"
            description="Log sets, reps, and weights in real time"
          />
          <FeatureItem
            icon="\uD83D\uDCCA"
            title="See progress"
            description="Charts and history to keep you motivated"
          />
          <FeatureItem
            icon="\uD83E\uDD16"
            title="AI import"
            description="Paste any routine URL or text and let AI extract it"
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={handleGetStarted}>
          <Text style={styles.primaryButtonText}>Get started</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.heading}>How to begin?</Text>
      <Text style={styles.subheading}>Choose how you want to start your fitness journey</Text>

      <View style={styles.options}>
        <OptionCard
          icon="\u26A1"
          title="Start Free Flow"
          description="Jump right in — log exercises as you go without a preset routine"
          onPress={handleStartFreeFlow}
        />

        <OptionCard
          icon="\uD83D\uDD17"
          title="Import from URL"
          description="Paste a routine from any fitness website and let AI extract it"
          onPress={() => navigation.navigate('MoreTab', { screen: 'ImportRoutine' })}
        />

        <OptionCard
          icon="\uD83D\uDCD6"
          title="Browse Exercises"
          description="Explore the exercise library and build your own routine"
          onPress={handleBrowseExercises}
        />
      </View>

      <Text style={styles.demoLabel}>Try a demo import:</Text>
      {DEMO_URLS.map((demo) => (
        <Pressable
          key={demo.url}
          style={styles.demoRow}
          onPress={() => handleDemoImport(demo.url)}
          disabled={importing}
        >
          <Text style={styles.demoLink}>{demo.label}</Text>
          <Text style={styles.demoUrl}>{demo.url}</Text>
        </Pressable>
      ))}

      {importing && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Importing routine…</Text>
        </View>
      )}
    </ScrollView>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </View>
  );
}

function OptionCard({ icon, title, description, onPress }) {
  return (
    <Pressable style={styles.optionCard} onPress={onPress}>
      <Text style={styles.optionIcon}>{icon}</Text>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <Text style={styles.optionArrow}>{'\u203A'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  // Screen 1: Welcome
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  features: {
    gap: spacing.lg,
    marginBottom: spacing.xl * 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  featureIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  featureDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  // Screen 2: How to begin
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 21,
  },
  options: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionArrow: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  demoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  demoRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoLink: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  demoUrl: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
