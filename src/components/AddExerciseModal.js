// AddExerciseModal — pick an exercise to add to the live session.
//
// PRD: keyboard auto-focused, suggestions sorted by pair-frequency DESC (seeded
// by the last exercise added), and a "create new" affordance at the bottom.
// Selecting an existing exercise calls onSelect(id); the create-new row calls
// onCreateNew(name) so the owning screen can create + add in one step.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useWorkoutStore } from '../stores/workoutStore.js';
import { colors, radius, spacing } from '../theme.js';

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {(exerciseId: number) => void} props.onSelect
 * @param {(name: string) => void} props.onCreateNew  called with the typed name (may be '')
 * @param {() => void} props.onClose
 */
export default function AddExerciseModal({ visible, onSelect, onCreateNew, onClose }) {
  const suggestExercises = useWorkoutStore((s) => s.suggestExercises);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Reset the query each time the modal opens; auto-focus the keyboard.
  useEffect(() => {
    if (visible) {
      setQuery('');
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    Keyboard.dismiss();
  }, [visible]);

  const results = useMemo(() => (visible ? suggestExercises(query) : []), [visible, query, suggestExercises]);

  const handleSelect = (id) => {
    onSelect(id);
  };
  const handleCreate = () => {
    onCreateNew(query.trim());
  };

  const renderItem = ({ item }) => (
    <Pressable
      style={styles.row}
      onPress={() => handleSelect(item.id)}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          {item.pair_count > 0 ? `paired ${item.pair_count}×` : 'library'}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Add exercise</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={64}
        >
          <TextInput
            ref={inputRef}
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search or type a new exercise name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <FlatList
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <Text style={styles.empty}>No matches — create a new one below.</Text>
            }
            ListFooterComponent={
              <Pressable
                style={[styles.row, styles.createRow]}
                onPress={handleCreate}
                android_ripple={{ color: colors.primarySoft }}
              >
                <Text style={styles.createText}>
                  {query.trim() ? `Create new "${query.trim()}"` : 'Create new exercise'}
                </Text>
              </Pressable>
            }
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    flex: 1,
    marginTop: 64,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  close: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  search: {
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  list: { flex: 1, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  name: { fontSize: 16, color: colors.text, fontWeight: '500' },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chev: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  empty: { color: colors.textMuted, paddingVertical: spacing.lg, textAlign: 'center' },
  createRow: {
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    justifyContent: 'center',
  },
  createText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});