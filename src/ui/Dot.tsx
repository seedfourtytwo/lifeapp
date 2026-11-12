import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DOT_SIZE, nightColors, type NightLight } from './tokens';

type Props = {
  /** A light for a kind of thing, or the lamp for a milestone. */
  light: NightLight | 'lamp';
};

/** A small dot carrying a light beside a name: the one lit feature of a row that has no lit control. */
export function Dot({ light }: Props) {
  return (
    <View
      style={[dotStyles.dot, { backgroundColor: nightColors[light] }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export const dotStyles = StyleSheet.create({
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    // Geometry: a circle.
    borderRadius: DOT_SIZE / 2,
  },
});
