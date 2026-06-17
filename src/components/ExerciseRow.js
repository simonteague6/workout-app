// ExerciseRow — a library row with a swipe-to-edit gesture.
//
// Swiping left reveals an Edit action (PRD story 44 / issue #2 acceptance:
// "swipe-to-edit gesture on exercise rows"). Tapping the row opens the
// exercise detail. Implemented with PanResponder + Animated so it stays
// dependency-free (no react-native-gesture-handler). Horizontal gestures are
// claimed only past a small threshold, so a plain tap still reaches the
// Pressable and fires onPress.

import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme.js';

const ACTION_WIDTH = 84;

/**
 * @param {object} props
 * @param {object} props.exercise       resolved exercise row from exerciseStore
 * @param {(id: number) => void} props.onPress   tap on the row (opens detail)
 * @param {(id: number) => void} props.onEdit    swipe-revealed edit action
 */
export default function ExerciseRow({ exercise, onPress, onEdit }) {
  const [open, setOpen] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);

  // Reset swipe state when the row recycles to a different exercise (FlatList
  // reuses instances, so without this an opened position could leak across
  // items).
  useEffect(() => {
    translateX.setValue(0);
    setOpen(false);
  }, [exercise.id, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim horizontal drags past a threshold, preferring horizontal
      // over vertical so vertical scrolling still works.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        startX.current = translateX._value;
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.max(-ACTION_WIDTH, Math.min(0, startX.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const pos = startX.current + g.dx;
        const shouldOpen = pos < -ACTION_WIDTH / 2;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
          overshootClamping: true,
        }).start();
        setOpen(shouldOpen);
      },
    }),
  ).current;

  const handlePress = () => {
    if (open) {
      // Tap while open closes the action instead of navigating.
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      setOpen(false);
      return;
    }
    onPress?.(exercise.id);
  };

  const subtitle = [
    exercise.primary_muscle,
    exercise.secondary_muscle ? `+ ${exercise.secondary_muscle}` : null,
    exercise.equipment,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <View style={styles.container}>
      {/* Edit action revealed behind the content on left swipe. */}
      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          onPress={() => onEdit?.(exercise.id)}
        >
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
      </View>

      {/* Content slides over the action layer. */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.content, { transform: [{ translateX }] }]}
      >
        <Pressable onPress={handlePress} style={styles.pressable}>
          <View style={styles.rowMain}>
            <Text style={styles.name} numberOfLines={1}>
              {exercise.name}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.badges}>
            {exercise.usage_count > 0 ? (
              <View style={styles.usageBadge}>
                <Text style={styles.usageText}>×{exercise.usage_count}</Text>
              </View>
            ) : null}
            {exercise.is_custom ? (
              <View style={styles.customBadge}>
                <Text style={styles.customText}>Custom</Text>
              </View>
            ) : null}
            {exercise.is_archived ? (
              <View style={styles.archivedBadge}>
                <Text style={styles.archivedText}>Archived</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.rowAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  content: {
    backgroundColor: colors.background,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  rowMain: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  usageBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  usageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  customBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  customText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  archivedBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  archivedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
});