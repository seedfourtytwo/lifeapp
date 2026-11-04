import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * One option in a pick-one row. Paper's flat chip paints picked and unpicked
 * in the same container colour, so the pick is filled with the primary colour
 * and the rest sit on the quiet variant fill.
 */
export default function ChoiceChip({ label, selected, onPress, style }: Props) {
  const theme = useTheme();
  return (
    <Chip
      selected={selected}
      showSelectedCheck={false}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        { backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant },
        style,
      ]}
      textStyle={{ color: selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
    >
      {label}
    </Chip>
  );
}
