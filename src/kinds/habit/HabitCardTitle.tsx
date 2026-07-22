import React from 'react';
import { Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { trackerCardStyles as styles } from '../trackerCardStyles';

type Props = {
  name: string;
  streakLabel?: string | null;
  description?: string | null;
  onOpenDetails?: () => void;
};

/** Shared title + optional streak/description sublines for habit Home cards. */
export function HabitCardTitle({
  name,
  streakLabel = null,
  description = null,
  onOpenDetails,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onOpenDetails}
      disabled={!onOpenDetails}
      style={({ pressed }) => [
        styles.titlePress,
        pressed && onOpenDetails && styles.pressed,
      ]}
    >
      <Text
        variant="titleMedium"
        numberOfLines={1}
        style={[styles.name, { color: theme.colors.onSurface }]}
      >
        {name}
      </Text>
      {streakLabel ? (
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[styles.subline, { color: theme.colors.onSurfaceVariant }]}
        >
          {streakLabel}
        </Text>
      ) : null}
      {description ? (
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[styles.subline, { color: theme.colors.onSurfaceVariant }]}
        >
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}
