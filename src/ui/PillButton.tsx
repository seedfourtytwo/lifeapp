import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GlassFill } from './GlassFill';
import { NightText } from './NightText';
import { nightColors, nightRadius, nightState, nightStroke, space, TOUCH_MIN, type NightLight } from './tokens';

type Props = {
  label: string;
  onPress: () => void;
  /**
   * Primary: a thin ring in its light, the one thing to press. Quiet: a plain
   * edge and a dimmed label. Danger: the ring and label in the danger colour,
   * only for what cannot be undone.
   */
  variant: 'primary' | 'quiet' | 'danger';
  /** The primary ring's light. */
  light?: NightLight;
  /** A small pill beside a title: "Edit". Still a full touch target. */
  compact?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** A capsule of glass with one line on it. Grows with the system font; never fixed in height. */
export function PillButton({ label, onPress, variant, light = 'amber', compact = false, accessibilityLabel, disabled }: Props) {
  const ring =
    variant === 'quiet'
      ? { borderWidth: nightStroke.quiet, borderColor: nightColors.quietEdge }
      : { borderWidth: nightStroke.lit, borderColor: variant === 'danger' ? nightColors.danger : nightColors[light] };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={compact ? space.xs : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        pillButtonStyles.pill,
        compact && pillButtonStyles.compact,
        ring,
        pressed && pillButtonStyles.pressed,
        disabled && pillButtonStyles.disabled,
      ]}
    >
      <GlassFill />
      <NightText
        kind={compact ? 'caption' : 'name'}
        tone={variant === 'danger' ? 'danger' : variant === 'quiet' ? 'dim' : 'cream'}
        style={pillButtonStyles.label}
      >
        {label}
      </NightText>
    </Pressable>
  );
}

export const pillButtonStyles = StyleSheet.create({
  pill: {
    minHeight: 56,
    minWidth: TOUCH_MIN * 2,
    borderRadius: nightRadius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  compact: {
    minHeight: TOUCH_MIN - space.sm,
    minWidth: TOUCH_MIN,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
