// ExerciseLibraryScreen — browse + search the Exercise Library.
//
// Registered in both the More and History stacks (PRD §Navigation: exercise
// list accessible from both tabs with correct back navigation). The screen is
// a thin navigation shell around ExerciseLibraryList; tapping a row opens the
// detail card, swiping reveals edit, and the header + footer offer create.

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import ExerciseLibraryList from '../../components/ExerciseLibraryList.js';
import { colors, spacing } from '../../theme.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp }} props
 */
export default function ExerciseLibraryScreen({ navigation }) {
  const searchBarPosition = useSettingsStore((s) => s.searchBarPosition);

  // Header "+" to create a custom exercise, in addition to the in-list affordance.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('ExerciseEditor')} hitSlop={8}>
          <Text style={styles.headerAction}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <ExerciseLibraryList
      searchBarPosition={searchBarPosition}
      onSelectExercise={(id) => navigation.navigate('ExerciseDetail', { exerciseId: id })}
      onEditExercise={(id) => navigation.navigate('ExerciseEditor', { exerciseId: id })}
      onCreateExercise={() => navigation.navigate('ExerciseEditor')}
    />
  );
}

const styles = StyleSheet.create({
  headerAction: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '400',
    paddingHorizontal: spacing.sm,
  },
});
