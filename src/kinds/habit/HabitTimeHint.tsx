import React from 'react';
import { Text, useTheme } from 'react-native-paper';
import { habitTimeHintLabel, type HabitTimeSlot } from '../../protocol';
import { habitWidgetStyles as styles } from './habitWidgetStyles';

type Props = {
  timeSlot: HabitTimeSlot;
};

/** Quiet AM / Lunch / PM cue — not a structural list label. */
export function HabitTimeHint({ timeSlot }: Props) {
  const theme = useTheme();
  const label = habitTimeHintLabel(timeSlot);
  if (!label) return null;

  return (
    <Text
      variant="labelSmall"
      style={[styles.timeHint, { color: theme.colors.outline }]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}
