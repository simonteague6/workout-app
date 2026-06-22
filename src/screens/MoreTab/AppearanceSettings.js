import { useState } from 'react';
import { Alert } from 'react-native';

import { ScreenContainer, Section, SegmentedControl, TextInputField, PrimaryButton } from '../../components/SettingsControls.js';
import { useSettingsStore, UNITS, THEME, SEARCH_BAR_POSITIONS, HAPTICS } from '../../stores/settingsStore.js';

// Appearance — theme, units, and app-wide default values. Theme and unit
// toggles write through immediately (and persist); the default rest timer and
// weight increment are batched behind a Save button so partial typing never
// reaches the database.
export default function AppearanceSettings() {
  const {
    unit,
    theme,
    haptics,
    defaultRestSeconds,
    defaultIncrement,
    searchBarPosition,
    setUnit,
    setTheme,
    setHaptics,
    setSearchBarPosition,
    setDefaultRestSeconds,
    setDefaultIncrement,
  } = useSettingsStore();

  const [rest, setRest] = useState(String(defaultRestSeconds));
  const [increment, setIncrement] = useState(String(defaultIncrement));

  function saveDefaults() {
    const r = Number(rest);
    const inc = Number(increment);
    if (!Number.isFinite(r) || r < 0) {
      Alert.alert('Invalid value', 'Default rest timer must be a number of seconds (0 or more).');
      return;
    }
    if (!Number.isFinite(inc) || inc <= 0) {
      Alert.alert('Invalid value', 'Default increment must be a positive number.');
      return;
    }
    setDefaultRestSeconds(r);
    setDefaultIncrement(inc);
    Alert.alert('Saved', 'Defaults updated.');
  }

  return (
    <ScreenContainer>
      <Section title="Theme">
        <SegmentedControl
          value={theme}
          onValueChange={setTheme}
          options={[
            { label: 'Light', value: THEME.LIGHT },
            { label: 'Dark', value: THEME.DARK },
            { label: 'System', value: THEME.SYSTEM },
          ]}
        />
      </Section>

      <Section title="Haptics">
        <SegmentedControl
          value={haptics}
          onValueChange={setHaptics}
          options={[
            { label: 'Full', value: HAPTICS.FULL },
            { label: 'Minimal', value: HAPTICS.MINIMAL },
            { label: 'Off', value: HAPTICS.OFF },
          ]}
        />
      </Section>

      <Section title="Units">
        <SegmentedControl
          value={unit}
          onValueChange={setUnit}
          options={[
            { label: 'lbs', value: UNITS.LBS },
            { label: 'kg', value: UNITS.KG },
          ]}
        />
      </Section>

      <Section title="Search bar position">
        <SegmentedControl
          value={searchBarPosition}
          onValueChange={setSearchBarPosition}
          options={[
            { label: 'Top', value: SEARCH_BAR_POSITIONS.TOP },
            { label: 'Bottom', value: SEARCH_BAR_POSITIONS.BOTTOM },
          ]}
        />
      </Section>

      <Section title="Workout Defaults">
        <TextInputField
          label="Default rest timer (seconds)"
          value={rest}
          onChange={setRest}
          keyboardType="numeric"
          placeholder="120"
        />
        <TextInputField
          label={`Default weight increment (${unit})`}
          value={increment}
          onChange={setIncrement}
          keyboardType="numeric"
          placeholder="2.5"
        />
        <PrimaryButton label="Save defaults" onPress={saveDefaults} />
      </Section>
    </ScreenContainer>
  );
}
