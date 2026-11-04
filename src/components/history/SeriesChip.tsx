import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, useTheme, type MD3Theme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';

type ChipState = { selected: boolean; color?: string; disabled?: boolean };

/**
 * Fill and label for a compare chip. Picked, it takes its series colour, so
 * the chip row is also the chart's legend; idle, it is a card-coloured pill on
 * the page; past the cap it drops to the well with quiet text rather than
 * fading, since faded text falls under the contrast floor.
 */
export function seriesChipColors(
  colors: MD3Theme['colors'],
  { selected, color, disabled }: ChipState,
): { background: string; label: string } {
  if (selected && color) return { background: color, label: colors.onPrimary };
  if (disabled) return { background: colors.surfaceVariant, label: colors.onSurfaceVariant };
  return { background: colors.surface, label: colors.onSurface };
}

type Props = ChipState & {
  label: string;
  onPress: () => void;
};

/**
 * One tracker in Insights' compare row. Shaped like `ChoiceChip`, but several
 * can be picked and each picked one wears its own series colour, which a
 * moss-only pick could not show.
 */
export default function SeriesChip({ label, selected, color, disabled = false, onPress }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const { background, label: ink } = seriesChipColors(theme.colors, { selected, color, disabled });
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      android_ripple={{ color: theme.colors.outlineVariant }}
      style={[styles.chip, { backgroundColor: background, borderRadius: deco.radius.pill }]}
    >
      <Text numberOfLines={1} style={[styles.label, { color: ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    maxWidth: '100%',
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});
