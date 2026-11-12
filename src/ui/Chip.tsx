import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { NightText } from './NightText';
import { nightColors, nightRadius, nightState, nightStroke, space, TOUCH_MIN, type NightLight } from './tokens';

type Content =
  | {
      label: string;
      /** Chosen: a lit ring and cream words. Leave undefined for a chip that is not a choice. */
      selected?: boolean;
      add?: never;
    }
  | {
      /** The "+" at the end of a row of chips: add another. */
      add: true;
      label?: never;
      selected?: never;
    };

type Props = Content & {
  onPress: () => void;
  /** Required for the "+" chip, which shows no words. */
  accessibilityLabel?: string;
  /** The chosen ring's light. */
  light?: NightLight;
  disabled?: boolean;
};

/** A small capsule: a choice among a few, a time, a button value, or "+" to add one. */
export function Chip({ label, selected, add, onPress, accessibilityLabel, light = 'teal', disabled }: Props) {
  const lit = selected === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={space.xs}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      style={({ pressed }) => [
        chipStyles.chip,
        lit
          ? { borderWidth: nightStroke.lit, borderColor: nightColors[light] }
          : { borderWidth: nightStroke.quiet, borderColor: nightColors.quietEdge },
        pressed && chipStyles.pressed,
        disabled && chipStyles.disabled,
      ]}
    >
      {add ? (
        <Icon name="plus" size="sm" tone="dim" />
      ) : (
        <NightText kind="caption" tone={lit ? 'cream' : 'dim'}>
          {label}
        </NightText>
      )}
    </Pressable>
  );
}

export const chipStyles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_MIN - space.sm,
    minWidth: TOUCH_MIN - space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: nightRadius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
