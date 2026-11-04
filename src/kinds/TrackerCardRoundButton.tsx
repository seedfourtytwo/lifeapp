import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

const SIZE = 44;

type Props = {
  icon: 'play' | 'pause' | 'check';
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  /** Solid moss for the finishing action; a moss tint for play and pause. */
  tone?: 'tint' | 'solid';
  accessibilityLabel: string;
  accessibilityHint?: string;
};

/** The round action at the end of a timer row: play, pause, finish. */
export function TrackerCardRoundButton({
  icon,
  onPress,
  onLongPress,
  delayLongPress,
  tone = 'tint',
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  const solid = tone === 'solid';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: solid ? theme.colors.primary : theme.colors.primaryContainer },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={solid ? theme.colors.onPrimary : theme.colors.primary}
      />
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
