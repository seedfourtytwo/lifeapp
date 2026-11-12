import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { NightText } from './NightText';
import { nightState, space, TOUCH_MIN, type NightLight } from './tokens';

type Props = {
  label: string;
  onPress: () => void;
  /** Dimmed cream by default; cream for the one way back (Undo); a light when the action belongs to a kind of thing. */
  tone?: 'dim' | 'cream' | NightLight;
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** A quiet action in a line of text: words only, no glass, still a full touch target. */
export function TextButton({ label, onPress, tone = 'dim', accessibilityLabel, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        textButtonStyles.button,
        pressed && textButtonStyles.pressed,
        disabled && textButtonStyles.disabled,
      ]}
    >
      <NightText kind="name" tone={tone}>
        {label}
      </NightText>
    </Pressable>
  );
}

export const textButtonStyles = StyleSheet.create({
  button: {
    minHeight: TOUCH_MIN,
    minWidth: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.sm,
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
