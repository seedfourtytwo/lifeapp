import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dot } from './Dot';
import { Icon } from './Icon';
import { NightText } from './NightText';
import { nightState, space, TOUCH_MIN, type NightLight } from './tokens';

type Props = {
  label: string;
  /** What it is set to, dimmed on the right: "English", "20:00". */
  value?: string;
  /** A control on the right, after the value: a Toggle. */
  trailing?: React.ReactNode;
  /** A chevron on the right: the row opens something. */
  chevron?: boolean;
  /** A dot before the label, for a status line: "Backed up". */
  dot?: NightLight | 'lamp';
  /** The label in the danger colour: the few rows that cannot be undone. */
  danger?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

/** One line of a list or of Settings: a label, maybe a value, maybe a control or a chevron. */
export function Row({ label, value, trailing, chevron = false, dot, danger = false, onPress, disabled }: Props) {
  const content = (
    <>
      <View style={rowStyles.labelSide}>
        {dot ? <Dot light={dot} /> : null}
        <NightText kind="body" tone={danger ? 'danger' : 'cream'} style={rowStyles.label}>
          {label}
        </NightText>
      </View>
      <View style={rowStyles.valueSide}>
        {value ? (
          <NightText kind="caption" tone="dim" style={rowStyles.value}>
            {value}
          </NightText>
        ) : null}
        {trailing}
        {chevron ? <Icon name="chevron-right" size="md" tone="dim" /> : null}
      </View>
    </>
  );
  if (!onPress) {
    return (
      <View style={rowStyles.row} accessible={!trailing} accessibilityLabel={value ? `${label}, ${value}` : label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.pressed, disabled && rowStyles.disabled]}
    >
      {content}
    </Pressable>
  );
}

export const rowStyles = StyleSheet.create({
  row: {
    minHeight: TOUCH_MIN + space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
  },
  labelSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 1,
  },
  label: {
    flexShrink: 1,
  },
  valueSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 1,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
