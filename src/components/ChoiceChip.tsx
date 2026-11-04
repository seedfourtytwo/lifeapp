import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `checkbox` for a pick-many row (weekdays); a pick-one row stays `radio`. */
  role?: 'radio' | 'checkbox';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = 40;
/** Grows the 40dp pill to a 48dp touch target without making it look bigger. */
const HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

/**
 * One option in a pick-one row: a pill, the pick filled moss, the rest on the
 * ground colour. Drawn here rather than through Paper's chip, whose flat mode
 * paints picked and unpicked in one container colour and whose height drifts
 * with its icon slot.
 */
export default function ChoiceChip({
  label,
  selected,
  onPress,
  role = 'radio',
  accessibilityLabel,
  style,
}: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  return (
    <Pressable
      testID="choice-chip"
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      android_ripple={{ color: theme.colors.outlineVariant }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.background,
          borderRadius: deco.radius.pill,
        },
        style,
      ]}
    >
      <Text
        style={[styles.label, { color: selected ? theme.colors.onPrimary : theme.colors.onSurface }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: HEIGHT,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});
