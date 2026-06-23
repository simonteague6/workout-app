// History tab — calendar of past sessions (issue #6). Shows a month-grid
// calendar view with workout dots, navigation arrows, and session detail links.

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAnalyticsStore } from '../../stores/analyticsStore.js';
import { colors, radius, spacing } from '../../theme.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp }} props
 */
export default function CalendarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const calendarData = useAnalyticsStore((s) => s.calendarData);
  const loadCalendarData = useAnalyticsStore((s) => s.loadCalendarData);

  // Load calendar data whenever the month changes.
  useEffect(() => {
    const startDate = new Date(currentMonth.year, currentMonth.month, 1).toISOString().split('T')[0];
    const endDate = new Date(currentMonth.year, currentMonth.month + 1, 0).toISOString().split('T')[0];
    loadCalendarData({ startDate, endDate });
  }, [currentMonth, loadCalendarData]);

  // Build a Set of date strings that have workouts.
  const workoutDates = useMemo(() => {
    const set = new Set();
    for (const row of calendarData) {
      set.add(row.date);
    }
    return set;
  }, [calendarData]);

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
    const year = currentMonth.year;
    const month = currentMonth.month;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    // Empty cells before the first day.
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    // Day cells.
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: dateStr, hasWorkout: workoutDates.has(dateStr) });
    }
    return cells;
  }, [currentMonth, workoutDates]);

  const handleDayPress = useCallback(
    (dateStr) => {
      if (!workoutDates.has(dateStr)) return;
      navigation.navigate('SessionDetail', { date: dateStr });
    },
    [workoutDates, navigation],
  );

  const isCurrentMonth =
    currentMonth.year === new Date().getFullYear() && currentMonth.month === new Date().getMonth();

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Month header */}
      <View style={styles.monthHeader}>
        <Pressable onPress={goPrevMonth} style={styles.navButton} hitSlop={8}>
          <Text style={styles.navArrow}>{'<'}</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
        </Text>
        <Pressable onPress={goNextMonth} style={styles.navButton} hitSlop={8}>
          <Text style={styles.navArrow}>{'>'}</Text>
        </Pressable>
      </View>

      {/* Today button */}
      {!isCurrentMonth && (
        <Pressable onPress={goToday} style={styles.todayButton}>
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
      )}

      {/* Day-of-week header */}
      <View style={styles.weekHeader}>
        {DAY_NAMES.map((name) => (
          <Text key={name} style={styles.weekDayLabel}>{name}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {days.map((cell, i) => (
          <Pressable
            key={i}
            style={[
              styles.dayCell,
              cell && cell.hasWorkout && styles.dayCellActive,
            ]}
            onPress={() => cell && handleDayPress(cell.date)}
            disabled={!cell || !cell.hasWorkout}
          >
            {cell && (
              <>
                <Text style={[styles.dayText, cell.hasWorkout && styles.dayTextActive]}>
                  {cell.day}
                </Text>
                {cell.hasWorkout && <View style={styles.workoutDot} />}
              </>
            )}
          </Pressable>
        ))}
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
    padding: spacing.md,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  navArrow: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  todayButton: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
  },
  todayText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  dayCellActive: {
    backgroundColor: colors.primarySoft,
  },
  dayText: {
    fontSize: 14,
    color: colors.text,
  },
  dayTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  workoutDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
});
