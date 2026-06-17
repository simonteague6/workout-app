import { useState } from 'react';
import { Alert } from 'react-native';

import { ScreenContainer, Section, SegmentedControl, TextInputField, PrimaryButton } from '../../components/SettingsControls.js';
import { useSettingsStore, AI_PROVIDERS } from '../../stores/settingsStore.js';

// AI & API Keys — bring-your-own-key configuration for routine import. The
// provider/model/endpoint persist in SQLite; the API key is written to the
// device keystore via secureStorage (never SQLite). All fields batch behind a
// single Save so navigating away mid-edit doesn't store a half-config.
export default function AISettings() {
  const { ai, setAiConfig } = useSettingsStore();

  const [provider, setProvider] = useState(ai.provider ?? '');
  const [apiKey, setApiKey] = useState(ai.apiKey ?? '');
  const [model, setModel] = useState(ai.model ?? '');
  const [endpoint, setEndpoint] = useState(ai.endpoint ?? '');

  async function save() {
    if (provider && !endpoint && provider === AI_PROVIDERS.CUSTOM) {
      Alert.alert('Missing endpoint', 'A custom provider needs a base URL for the OpenAI-compatible server.');
      return;
    }
    try {
      await setAiConfig({ provider: provider || null, apiKey, model: model || null, endpoint: endpoint || null });
      Alert.alert('Saved', 'AI configuration updated.');
    } catch (err) {
      Alert.alert('Could not save', err.message);
    }
  }

  return (
    <ScreenContainer>
      <Section title="Provider">
        <SegmentedControl
          value={provider}
          onValueChange={setProvider}
          options={[
            { label: 'OpenAI', value: AI_PROVIDERS.OPENAI },
            { label: 'OpenRouter', value: AI_PROVIDERS.OPENROUTER },
            { label: 'Claude', value: AI_PROVIDERS.ANTHROPIC },
            { label: 'Custom', value: AI_PROVIDERS.CUSTOM },
          ]}
        />
      </Section>

      <Section title="Credentials">
        <TextInputField
          label="API key"
          value={apiKey}
          onChange={setApiKey}
          placeholder="sk-…"
          secure
        />
        <TextInputField
          label="Model"
          value={model}
          onChange={setModel}
          placeholder="e.g. gpt-4o-mini"
        />
        <TextInputField
          label="Custom endpoint (OpenAI-compatible base URL)"
          value={endpoint}
          onChange={setEndpoint}
          placeholder="https://my-server.example/v1"
        />
        <PrimaryButton label="Save AI config" onPress={save} />
      </Section>
    </ScreenContainer>
  );
}