import { useNavigation } from '@react-navigation/native';

import { ScreenContainer, Section, NavRow } from '../../components/SettingsControls.js';

// More — settings hub. Each row pushes a stack screen inside the More tab so
// the tab bar stays visible and a back button returns here. Issue #2 wires
// the Exercise Library; issue #7 wires Appearance, AI & API Keys, and Data.
export default function MoreScreen() {
  const navigation = useNavigation();
  return (
    <ScreenContainer>
      <Section title="Exercises">
        <NavRow label="Exercise Library" onPress={() => navigation.navigate('ExerciseLibrary')} last />
      </Section>
      <Section title="Settings">
        <NavRow label="Appearance" onPress={() => navigation.navigate('Appearance')} />
        <NavRow label="AI & API Keys" onPress={() => navigation.navigate('AISettings')} last />
      </Section>
      <Section title="Data">
        <NavRow label="Export / Import" onPress={() => navigation.navigate('Data')} last />
      </Section>
    </ScreenContainer>
  );
}