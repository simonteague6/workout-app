// History tab — calendar of past sessions (issue #6). Shows a month-grid
// calendar view with workout dots, navigation arrows, and session detail links.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '../../utils/db.js';
import { getCalendarData } from '../../db/queries/analyticsQueries.js';
import { colors, radius, spacing } from '../../theme.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp }} props
 */
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [workoutDates, setWorkoutDates] = useState(new Set());

  useEffect(() => {
    const db = getDatabase();
    const data = getCalendarData(db);
    const dates = new Set(data.map((d) => d.date));
    setWorkoutDates(dates);
  }, []);

  const goPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  const days = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    // Empty cells before the first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: dateStr, hasWorkout: workoutDates.has(dateStr) });
    }
    return cells;
  }, [currentMonth, workoutDates]);

  const handleDayPress = useCallback(
    (dateStr) => {
      if (!workoutDates.has(dateStr)) return;
      // Find the session for this date
      const db = getDatabase();
      const data = getCalendarData(db);
      const dayData = data.find((d) => d.date === dateStr);
      if (dayData && dayData.sessionCount > 0) {
        // Navigate to the first session of that day
        const { rows } = db.execute(
          `SELECT id FROM workout_session WHERE is_completed = 1 AND substr(started_at, 1, 10) = ? ORDER BY started_at ASC LIMIT 1`,
          [dateStr],
        );
        if (rows.length > 0) {
          navigation.navigate('SessionDetail', { sessionId: rows[0].id });
        }
      }
    },
    [workoutDates, navigation],
  );

  const isCurrentMonth =
    currentMonth.year === new Date().getFullYear() && currentMonth.month === new Date().getMonth();

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <Text style={styles.header}>History</Text>

      {/* Browse exercises button */}
      <Pressable
        style={styles.browseButton}
        onPress={() => navigation.navigate('ExerciseLibrary')}
        android_ripple={{ color: colors.primarySoft }}
      >
        <View style={styles.browseText}>
          <Text style={styles.browseTitle}>Browse exercises</Text>
          <Text style={styles.browseSub}>Search the library and view an exercise's history</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={goPrevMonth} style={styles.navArrow}>
          <Text style={styles.navArrowText}>‹</Text>
        </Pressable>
        <Pressable onPress={goToday} disabled={isCurrentMonth}>
          <Text style={[styles.monthTitle, isCurrentMonth && styles.monthTitleDisabled]}>
            {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
          </Text>
        </Pressable>
        <Pressable onPress={goNextMonth} style={styles.navArrow}>
          <Text style={styles.navArrowText}>›</Text>
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAY_NAMES.map((name) => (
          <Text key={name} style={styles.dayHeader}>
            {name}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {days.map((cell, i) => (
          <View key={i} style={styles.cellWrapper}>
            {cell ? (
              <Pressable
                onPress={() => handleDayPress(cell.date)}
                style={[
                  styles.dayCell,
                  cell.hasWorkout && styles.dayCellWorkout,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    cell.hasWorkout && styles.dayNumberWorkout,
                  ]}
                >
                  {cell.day}
                </Text>
                {cell.hasWorkout && <View style={styles.workoutDot} />}
              </Pressable>
            ) : (
              <View style={styles.dayCell} />
            )}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Workout day</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  browseText: {
    flex: 1,
  },
  browseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  browseSub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navArrow: {
    padding: spacing.sm,
  },
  navArrowText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '600',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  monthTitleDisabled: {
    color: colors.textMuted,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellWrapper: {
    width: '14.28%', // 1/7
    aspectRatio: 1,
    padding: 1,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  dayCellWorkout: {
    backgroundColor: colors.successSoft,
  },
  dayNumber: {
    fontSize: 14,
    color: colors.text,
  },
  dayNumberWorkout: {
    fontWeight: '600',
    color: colors.success,
  },
  workoutDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
    marginTop: 2,
  },
  legend: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
