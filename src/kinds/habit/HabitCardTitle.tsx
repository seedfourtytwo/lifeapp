import React, { useRef } from 'react';
import {
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import type { TrackerIconId } from '../../protocol';
import { trackerCardStyles as styles } from '../trackerCardStyles';

type Props = {
  name: string;
  /** Optional curated tracker icon shown before the name. */
  icon?: TrackerIconId | null;
  /** Compact streak day count shown inline after the name. */
  streakDays?: number | null;
  /** Full streak phrase for screen readers. */
  streakAccessibilityLabel?: string | null;
  onOpenDetails?: () => void;
  /** Long-press on the title starts Home list drag-reorder. */
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
};

/**
 * Shared name + optional inline streak for habit Home one-liners.
 * Reorder touch handlers stay on this Pressable so the activating finger can drag.
 */
export function HabitCardTitle({
  name,
  icon = null,
  streakDays = null,
  streakAccessibilityLabel = null,
  onOpenDetails,
  onLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  delayLongPressReorder = 380,
  reorderHint,
}: Props) {
  const theme = useTheme();
  const suppressNextPress = useRef(false);
  const showStreak = streakDays != null && streakDays > 0;
  const label =
    showStreak && streakAccessibilityLabel
      ? `${name}, ${streakAccessibilityLabel}`
      : name;

  return (
    <Pressable
      onPress={() => {
        if (suppressNextPress.current) {
          suppressNextPress.current = false;
          return;
        }
        onOpenDetails?.();
      }}
      onLongPress={
        onLongPressReorder
          ? (event) => {
              suppressNextPress.current = true;
              onLongPressReorder(event);
            }
          : undefined
      }
      delayLongPress={delayLongPressReorder}
      onTouchMove={onLongPressReorder ? onReorderTouchMove : undefined}
      onTouchEnd={
        onLongPressReorder
          ? (event) => {
              onReorderTouchEnd?.(event);
              // RN skips onPress after a successful long-press, so clear the
              // suppress flag for the *next* tap (details / counter open).
              requestAnimationFrame(() => {
                suppressNextPress.current = false;
              });
            }
          : undefined
      }
      onTouchCancel={
        onLongPressReorder
          ? (event) => {
              onReorderTouchCancel?.(event);
              requestAnimationFrame(() => {
                suppressNextPress.current = false;
              });
            }
          : undefined
      }
      disabled={!onOpenDetails && !onLongPressReorder}
      style={({ pressed }) => [
        styles.titlePress,
        styles.titleInline,
        pressed && (onOpenDetails || onLongPressReorder) && styles.pressed,
      ]}
      accessibilityRole={onOpenDetails || onLongPressReorder ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={onLongPressReorder ? reorderHint : undefined}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={theme.colors.primary}
          style={styles.titleIcon}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
      <Text
        variant="titleMedium"
        numberOfLines={1}
        style={[styles.name, { color: theme.colors.onSurface }]}
      >
        {name}
      </Text>
      {showStreak ? (
        <View
          style={styles.streakInline}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <MaterialCommunityIcons
            name="fire"
            size={16}
            color={theme.colors.primary}
          />
          <Text
            variant="labelLarge"
            style={[styles.streakCount, { color: theme.colors.primary }]}
          >
            {streakDays}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
