// CalendarHeatmap — GitHub-contribution-style heatmap grid.
// Renders a grid of small squares colored by workout count per day.
// ~7 rows (days of week) × ~52 columns (weeks of year).

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme.js';

const CELL_SIZE = 10;
const CELL_GAP = 2;
const LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 14;

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/**
 * @param {{ data: { date: string, count: number }[] }} props
 */
export default function CalendarHeatmap({ data }) {
  const { weeks, monthLabels } = useMemo(() => buildHeatmap(data), [data]);

  return (
    <View style={styles.container}>
      {/* Month labels */}
      <View style={styles.monthRow}>
        <View style={{ width: LABEL_WIDTH }} />
        {monthLabels.map((m, i) => (
          <Text key={i} style={[styles.monthLabel, { width: m.width }]}>
            {m.label}
          </Text>
        ))}
      </View>

      {/* Grid rows */}
      <View style={styles.grid}>
        {weeks[0]?.map((_, dayIdx) => (
          <View key={dayIdx} style={styles.row}>
            <Text style={styles.dayLabel}>{DAY_LABELS[dayIdx]}</Text>
            <View style={styles.cellsRow}>
              {weeks.map((week, weekIdx) => {
                const cell = week[dayIdx];
                return (
                  <View
                    key={weekIdx}
                    style={[
                      styles.cell,
                      { backgroundColor: getColor(cell?.count ?? 0) },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        {[0, 1, 2, 3].map((level) => (
          <View key={level} style={[styles.legendCell, { backgroundColor: getColor(level) }]} />
        ))}
        <Text style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
}

function getColor(count) {
  if (count === 0) return '#ebedf0';
  if (count === 1) return '#9be9a8';
  if (count === 2) return '#40c463';
  return '#30a14e';
}

function buildHeatmap(data) {
  const countByDate = new Map();
  for (const d of data) {
    countByDate.set(d.date, d.count);
  }

  const now = new Date();
  // Find the most recent Sunday
  const end = new Date(now);
  end.setDate(end.getDate() - end.getDay());

  // Go back ~52 weeks (364 days) from end
  const start = new Date(end);
  start.setDate(start.getDate() - 363);

  // Build weeks array: array of 7-element arrays (Sun=0, Mon=1, ..., Sat=6)
  const weeks = [];
  const monthLabels = [];
  let currentWeek = new Array(7).fill(null);
  let lastMonth = -1;

  const cursor = new Date(start);
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay();
    const dateStr = cursor.toISOString().slice(0, 10);
    const month = cursor.getMonth();

    currentWeek[dayOfWeek] = { date: dateStr, count: countByDate.get(dateStr) ?? 0 };

    // Track month labels at the start of each month
    if (month !== lastMonth && dayOfWeek <= 3) {
      const monthName = cursor.toLocaleDateString('en-US', { month: 'short' });
      // Estimate width: ~2.5 chars per letter
      monthLabels.push({ label: monthName, width: monthName.length * 8 + 4 });
    } else if (month !== lastMonth) {
      // Month starts later in the week — still add a narrow label
      const monthName = cursor.toLocaleDateString('en-US', { month: 'short' });
      monthLabels.push({ label: monthName, width: monthName.length * 8 + 4 });
    }
    lastMonth = month;

    // If Saturday, start a new week
    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = new Array(7).fill(null);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Push the last partial week if it has any cells
  if (currentWeek.some((c) => c !== null)) {
    weeks.push(currentWeek);
  }

  return { weeks, monthLabels };
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: MONTH_LABEL_HEIGHT,
    marginLeft: LABEL_WIDTH,
    marginBottom: 2,
  },
  monthLabel: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CELL_SIZE + CELL_GAP,
  },
  dayLabel: {
    width: LABEL_WIDTH,
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'right',
    paddingRight: 4,
  },
  cellsRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: 3,
  },
  legendLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginHorizontal: 2,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
