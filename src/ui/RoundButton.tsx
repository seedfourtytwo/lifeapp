import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GlassFill } from './GlassFill';
import { Icon, type IconName } from './Icon';
import { NightText } from './NightText';
import {
  nightColors,
  nightRadius,
  nightState,
  nightStroke,
  roundSize,
  space,
  TOUCH_MIN,
  type NightLight,
  type RoundSize,
} from './tokens';

type Content =
  | { icon: IconName; label?: never }
  /** A few characters instead of an icon: a counter's "+1". */
  | { label: string; icon?: never };

type Props = Content & {
  onPress: () => void;
  accessibilityLabel: string;
  size?: RoundSize;
  /** Lit: a thin ring in this light. Without one, a plain edge. */
  light?: NightLight;
  /** The current place in the dock. Said to a screen reader as selected. */
  selected?: boolean;
  /** The icon in the danger colour: Delete. */
  danger?: boolean;
  disabled?: boolean;
};

/**
 * A round glass tool: one icon, or a few characters. An icon keeps one size at
 * any font scale; characters can grow, and the circle becomes a capsule
 * rather than clipping them.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  accessibilityLabel,
  size = 'md',
  light,
  selected,
  danger = false,
  disabled,
}: Props) {
  const { box, icon: glyph } = roundSize[size];
  const extra = Math.max(0, (TOUCH_MIN - box) / 2);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={extra || undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), selected: selected ?? undefined }}
      style={({ pressed }) => [
        roundButtonStyles.button,
        icon ? { width: box, height: box } : [roundButtonStyles.characters, { minWidth: box, minHeight: box }],
        light
          ? { borderWidth: nightStroke.lit, borderColor: nightColors[light] }
          : { borderWidth: nightStroke.quiet, borderColor: nightColors.quietEdge },
        pressed && roundButtonStyles.pressed,
        disabled && roundButtonStyles.disabled,
      ]}
    >
      <GlassFill />
      {icon ? (
        <Icon name={icon} size={glyph} tone={danger ? 'danger' : 'cream'} />
      ) : (
        <NightText kind="name" style={roundButtonStyles.label}>
          {label}
        </NightText>
      )}
    </Pressable>
  );
}

export const roundButtonStyles = StyleSheet.create({
  button: {
    borderRadius: nightRadius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  characters: {
    paddingHorizontal: space.sm,
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
