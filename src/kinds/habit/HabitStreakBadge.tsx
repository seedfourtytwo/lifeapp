import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { shouldShowHabitStreakOnCard, type HabitConfig } from '../../protocol';

type Props = {
  config: HabitConfig;
  streak?: number;
  failureStreak?: number;
};

export function HabitStreakBadge({ config, streak, failureStreak }: Props) {
  if (!shouldShowHabitStreakOnCard(config)) {
    return null;
  }

  if (streak && streak > 0) {
    return (
      <Text variant="labelSmall" style={styles.streak}>
        {streak} day{streak === 1 ? '' : 's'}
      </Text>
    );
  }

  if (failureStreak && failureStreak > 0) {
    return (
      <Text variant="labelSmall" style={[styles.streak, styles.failureStreak]}>
        {failureStreak} missed
      </Text>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  streak: {
    marginTop: 2,
    opacity: 0.7,
    fontWeight: '600',
  },
  failureStreak: {
    opacity: 0.85,
    color: '#B3261E',
  },
});
