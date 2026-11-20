import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

const SIZE = 44;

type Props = {
  icon: 'play' | 'pause' | 'check';
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  accessibilityLabel: string;
  accessibilityHint?: string;
};

/**
 * The round action at the end of a timer row — play, pause, finish — in the
 * timers' colour: its wash for the ground, its ink for the glyph.
 */
export function TrackerCardRoundButton({
  icon,
  onPress,
  onLongPress,
  delayLongPress,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { palette } = useAppTheme();
  const paint = palette.kind.timer;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: paint.wash },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <MaterialCommunityIcons name={icon} size={24} color={paint.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    // Geometry: a circle.
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
