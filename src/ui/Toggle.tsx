import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { timingOrSnap } from '../utils/motion';
import { lightTint, nightColors, nightMotion, nightRadius, nightState, nightStroke, space, toggleSize, TOUCH_MIN, type NightLight } from './tokens';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** What it switches: usually the row's label. */
  accessibilityLabel: string;
  /** The light it shows when on. Teal by default: most switches are about the day's practice. */
  light?: NightLight;
  disabled?: boolean;
};

const TRAVEL = toggleSize.width - toggleSize.knob - 2 * ((toggleSize.height - toggleSize.knob) / 2);

/** On or off. On: the track takes its light's tint and ring, the knob turns cream. The knob slides, or snaps under reduced motion. */
export function Toggle({ value, onValueChange, accessibilityLabel, light = 'teal', disabled }: Props) {
  const reduceMotion = useReduceMotion();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    const animation = timingOrSnap(
      position,
      { toValue: value ? 1 : 0, duration: nightMotion.quick, easing: Easing.out(Easing.quad), useNativeDriver: true },
      reduceMotion,
    );
    animation.start();
    return () => animation.stop();
  }, [value, position, reduceMotion]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={(TOUCH_MIN - toggleSize.height) / 2}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        toggleStyles.track,
        value
          ? { backgroundColor: lightTint[light], borderColor: nightColors[light] }
          : { backgroundColor: nightColors.track, borderColor: nightColors.track },
        pressed && toggleStyles.pressed,
        disabled && toggleStyles.disabled,
      ]}
    >
      <Animated.View
        style={[
          toggleStyles.knob,
          { backgroundColor: value ? nightColors.cream : nightColors.creamDim },
          { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }] },
        ]}
      />
    </Pressable>
  );
}

export const toggleStyles = StyleSheet.create({
  track: {
    width: toggleSize.width,
    height: toggleSize.height,
    borderRadius: nightRadius.pill,
    borderWidth: nightStroke.lit,
    justifyContent: 'center',
    paddingHorizontal: (toggleSize.height - toggleSize.knob) / 2 - nightStroke.lit,
    marginHorizontal: space.xxs,
  },
  knob: {
    width: toggleSize.knob,
    height: toggleSize.knob,
    borderRadius: nightRadius.pill,
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
