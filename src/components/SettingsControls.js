// SettingsControls — small, theme-aware primitives shared by the More-tab
// settings screens (issue #7). Kept minimal and stateless: each reads the
// active palette via useAppTheme and styles itself, so a theme toggle
// re-renders every screen at once. Not unit-tested (UI rendering is out of
// scope per AGENTS.md); the store/query logic behind these controls is.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../theme/index.js';

export function ScreenContainer({ children, pad = 16 }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background, paddingTop: insets.top }}
      contentContainerStyle={{ padding: pad }}
    >
      {children}
    </ScrollView>
  );
}

export function Section({ title, children }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

export function Row({ label, value, children, last }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, !last && styles.rowBorder, { borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value != null ? <Text style={[styles.rowValue, { color: colors.secondary }]}>{value}</Text> : null}
      {children}
    </View>
  );
}

export function NavRow({ label, onPress, last }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        { borderColor: colors.border },
        pressed && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.chevron, { color: colors.secondary }]}>›</Text>
    </Pressable>
  );
}

export function SegmentedControl({ options, value, onValueChange }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.segmentRow, { borderColor: colors.border }]}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onValueChange(opt.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: colors.accent },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: selected ? '#fff' : colors.text },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextInputField({ label, value, onChange, placeholder, keyboardType = 'default', secure = false }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.secondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.secondary}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

export function PrimaryButton({ label, onPress, tone = 'accent', disabled }) {
  const { colors } = useAppTheme();
  const bg = tone === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16, flex: 1 },
  rowValue: { fontSize: 16 },
  chevron: { fontSize: 22, fontWeight: '300' },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 12,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  field: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});