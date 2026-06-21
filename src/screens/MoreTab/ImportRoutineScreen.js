// ImportRoutineScreen — entry point for the AI routine import feature.
// User pastes a URL or text, taps "Import", and the pipeline runs.
// On success, navigates to ImportReviewScreen with the result.

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ScreenContainer, Section, PrimaryButton } from '../../components/SettingsControls.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { getDatabase } from '../../utils/db.js';
import { importRoutine } from '../../ai/routineImport.js';
import { colors, spacing, radius } from '../../theme.js';

export default function ImportRoutineScreen() {
  const navigation = useNavigation();
  const { ai } = useSettingsStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleImport() {
    if (!input.trim()) {
      Alert.alert('Empty input', 'Paste a routine URL or text first.');
      return;
    }

    if (!ai.apiKey) {
      Alert.alert(
        'API key required',
        'Configure your AI provider in Settings > AI & API Keys before importing.',
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const db = getDatabase();
      const result = await importRoutine(db, ai, input.trim());
      navigation.navigate('ImportReview', { importResult: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        <Section title="Import a routine">
          <Text style={styles.description}>
            Paste a URL from a fitness website or copy/paste routine text. The AI will extract
            exercises, sets, and rest times automatically.
          </Text>

          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Paste URL or routine text here…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <PrimaryButton
            label={loading ? 'Importing…' : 'Import'}
            onPress={handleImport}
            disabled={loading || !input.trim()}
          />

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Analyzing routine with AI…</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Import failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </Section>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 120,
    marginBottom: spacing.md,
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
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
