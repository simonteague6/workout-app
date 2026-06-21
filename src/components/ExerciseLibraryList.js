// ExerciseLibraryList — the browse/search UI for the Exercise Library.
//
// Used by the ExerciseLibraryScreen (registered in both the More and History
// stacks, per PRD §Navigation Structure). Owns the search input, the muscle /
// equipment filter chips, and the frequency-sorted FlatList of ExerciseRow.
// Delegates all data to exerciseStore; navigation (open detail / edit) is
// passed in from the owning screen so the same list works from either tab.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useExerciseStore } from '../stores/exerciseStore.js';
import { colors, radius, spacing } from '../theme.js';
import ExerciseRow from './ExerciseRow.js';
import OptionPickerModal from './OptionPickerModal.js';

/**
 * @param {object} props
 * @param {(id: number) => void} props.onSelectExercise
 * @param {(id: number) => void} props.onEditExercise
 * @param {() => void} props.onCreateExercise
 * @param {'top'|'bottom'} [props.searchBarPosition='top']
 */
export default function ExerciseLibraryList({ onSelectExercise, onEditExercise, onCreateExercise, searchBarPosition = 'top' }) {
  const exercises = useExerciseStore((s) => s.exercises);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const searchQuery = useExerciseStore((s) => s.searchQuery);
  const filters = useExerciseStore((s) => s.filters);
  const lookups = useExerciseStore((s) => s.lookups);
  const loadLibrary = useExerciseStore((s) => s.loadLibrary);
  const search = useExerciseStore((s) => s.search);
  const setFilters = useExerciseStore((s) => s.setFilters);
  const clearFilters = useExerciseStore((s) => s.clearFilters);

  const [picker, setPicker] = useState(null); // 'muscle' | 'equipment' | null

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleSearch = useCallback(
    (text) => {
      search(text);
    },
    [search],
  );

  const muscleName = useMemo(
    () => lookups.muscleGroups.find((m) => m.id === filters.muscleGroupId)?.name,
    [lookups.muscleGroups, filters.muscleGroupId],
  );
  const equipmentName = useMemo(
    () => lookups.equipment.find((e) => e.id === filters.equipmentId)?.name,
    [lookups.equipment, filters.equipmentId],
  );
  const hasFilters = filters.muscleGroupId != null || filters.equipmentId != null;

  const renderRow = useCallback(
    ({ item }) => (
      <ExerciseRow exercise={item} onPress={onSelectExercise} onEdit={onEditExercise} />
    ),
    [onSelectExercise, onEditExercise],
  );

  const searchBar = (
    <TextInput
      style={styles.search}
      value={searchQuery}
      onChangeText={handleSearch}
      placeholder="Search exercises by name"
      placeholderTextColor={colors.textMuted}
      autoCorrect={false}
      returnKeyType="search"
    />
  );

  const filterChips = (
    <View style={styles.chipRow}>
      <FilterChip
        label="Muscle"
        value={muscleName}
        onPress={() => setPicker('muscle')}
      />
      <FilterChip
        label="Equipment"
        value={equipmentName}
        onPress={() => setPicker('equipment')}
      />
      {hasFilters ? (
        <Pressable style={styles.clearChip} onPress={clearFilters}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const isBottom = searchBarPosition === 'bottom';

  const listHeader = (
    <View style={styles.controls}>
      {!isBottom && searchBar}
      {filterChips}
    </View>
  );

  const listContent = (
    <FlatList
      data={exercises}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderRow}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No exercises match your search.</Text>
            <Pressable style={styles.createLink} onPress={onCreateExercise}>
              <Text style={styles.createLinkText}>Create a custom exercise</Text>
            </Pressable>
          </View>
        )
      }
      ListFooterComponent={
        exercises.length > 0 ? (
          <Pressable style={styles.createFooter} onPress={onCreateExercise}>
            <Text style={styles.createFooterText}>+ Create custom exercise</Text>
          </Pressable>
        ) : null
      }
      contentContainerStyle={exercises.length === 0 ? styles.emptyList : styles.list}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isBottom ? (
        <>
          {listContent}
          <View style={styles.bottomSearchContainer}>
            {searchBar}
          </View>
        </>
      ) : (
        listContent
      )}

      <OptionPickerModal
        visible={picker === 'muscle'}
        title="Primary or secondary muscle"
        options={lookups.muscleGroups}
        value={filters.muscleGroupId}
        nullable
        onSelect={(opt) => setFilters({ muscleGroupId: opt ? opt.id : null })}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'equipment'}
        title="Equipment"
        options={lookups.equipment}
        value={filters.equipmentId}
        nullable
        onSelect={(opt) => setFilters({ equipmentId: opt ? opt.id : null })}
        onClose={() => setPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

function FilterChip({ label, value, onPress }) {
  const active = Boolean(value);
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {value ?? label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: { paddingBottom: spacing.xl },
  emptyList: { flex: 1 },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  bottomSearchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm * 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  clearChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  clearText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  createLink: {
    marginTop: spacing.md,
  },
  createLinkText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  createFooter: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  createFooterText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
});
