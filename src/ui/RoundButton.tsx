import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassFill } from './GlassFill';
import { LIT_STROKE, nightColors, QUIET_STROKE, type NightLight } from './tokens';

const SIZE = 56;

type Props = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  /** Lit: a thin ring in this light. Without one, a plain edge. */
  light?: NightLight;
};

/** A round glass tool holding one icon. Holds no text, so it keeps one size at any font scale. */
export function RoundButton({ icon, onPress, accessibilityLabel, light }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        roundButtonStyles.button,
        light
          ? { borderWidth: LIT_STROKE, borderColor: nightColors[light] }
          : { borderWidth: QUIET_STROKE, borderColor: nightColors.quietEdge },
        pressed && roundButtonStyles.pressed,
      ]}
    >
      <GlassFill />
      <MaterialCommunityIcons name={icon} size={24} color={nightColors.cream} />
    </Pressable>
  );
}

export const roundButtonStyles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    // Geometry: a circle.
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
