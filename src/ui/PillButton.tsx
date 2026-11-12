import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { space } from '../theme/spacing';
import { GlassFill } from './GlassFill';
import { NightText } from './NightText';
import { LIT_STROKE, nightColors, QUIET_STROKE, TOUCH_MIN, type NightLight } from './tokens';

type Props = {
  label: string;
  onPress: () => void;
  /** Primary: a thin ring in its light. Quiet: a plain edge and a dimmed label. */
  variant: 'primary' | 'quiet';
  /** The primary ring's light. */
  light?: NightLight;
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** A capsule of glass with one line on it. Grows with the system font; never fixed in height. */
export function PillButton({ label, onPress, variant, light = 'amber', accessibilityLabel, disabled }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        pillButtonStyles.pill,
        primary
          ? { borderWidth: LIT_STROKE, borderColor: nightColors[light] }
          : { borderWidth: QUIET_STROKE, borderColor: nightColors.quietEdge },
        pressed && pillButtonStyles.pressed,
        disabled && pillButtonStyles.disabled,
      ]}
    >
      <GlassFill />
      <NightText kind="name" tone={primary ? 'cream' : 'dim'} style={pillButtonStyles.label}>
        {label}
      </NightText>
    </Pressable>
  );
}

export const pillButtonStyles = StyleSheet.create({
  pill: {
    minHeight: 56,
    minWidth: TOUCH_MIN * 2,
    // Geometry: a capsule at any height.
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
