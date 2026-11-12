import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassFill } from './GlassFill';
import { NightText } from './NightText';
import { nightColors, nightRadius, nightState, nightStroke, space, TOUCH_MIN, type NightLight } from './tokens';

export type SegmentedOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  /** Two or three. More than three is a list, not a switch. */
  options: readonly [SegmentedOption<T>, SegmentedOption<T>] | readonly [SegmentedOption<T>, SegmentedOption<T>, SegmentedOption<T>];
  value: T;
  onChange: (value: T) => void;
  /** What is being chosen: "Type". */
  accessibilityLabel: string;
  /** The chosen segment's ring. */
  light?: NightLight;
  disabled?: boolean;
};

/** One of two or three: a sunk track, the chosen one raised in glass with a lit ring. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, light = 'teal', disabled }: Props<T>) {
  return (
    <View
      style={[segmentedStyles.track, disabled && segmentedStyles.disabled]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!chosen) onChange(option.value);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: chosen, disabled: Boolean(disabled) }}
            style={({ pressed }) => [
              segmentedStyles.segment,
              chosen && { borderWidth: nightStroke.lit, borderColor: nightColors[light] },
              pressed && segmentedStyles.pressed,
            ]}
          >
            {chosen ? <GlassFill /> : null}
            <NightText kind={chosen ? 'name' : 'body'} tone={chosen ? 'cream' : 'dim'} style={segmentedStyles.label}>
              {option.label}
            </NightText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const segmentedStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: nightRadius.field,
    borderWidth: nightStroke.quiet,
    borderColor: nightColors.quietEdge,
    backgroundColor: nightColors.well,
  },
  segment: {
    flex: 1,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    borderRadius: nightRadius.inner,
    overflow: 'hidden',
    paddingHorizontal: space.sm,
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
