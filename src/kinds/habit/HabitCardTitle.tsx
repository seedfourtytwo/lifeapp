import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { trackerCardStyles as styles } from '../trackerCardStyles';

type Props = {
  name: string;
  /** Compact streak day count shown inline after the name. */
  streakDays?: number | null;
  /** Full streak phrase for screen readers. */
  streakAccessibilityLabel?: string | null;
  onOpenDetails?: () => void;
};

/** Shared name + optional inline streak for habit Home one-liners. */
export function HabitCardTitle({
  name,
  streakDays = null,
  streakAccessibilityLabel = null,
  onOpenDetails,
}: Props) {
  const theme = useTheme();
  const showStreak = streakDays != null && streakDays > 0;

  return (
    <Pressable
      onPress={onOpenDetails}
      disabled={!onOpenDetails}
      style={({ pressed }) => [
        styles.titlePress,
        styles.titleInline,
        pressed && onOpenDetails && styles.pressed,
      ]}
      accessibilityRole={onOpenDetails ? 'button' : undefined}
      accessibilityLabel={
        showStreak && streakAccessibilityLabel
          ? `${name}, ${streakAccessibilityLabel}`
          : name
      }
    >
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
