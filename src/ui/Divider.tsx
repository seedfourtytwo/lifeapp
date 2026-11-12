import React from 'react';
import { StyleSheet, View } from 'react-native';
import { nightColors, nightStroke } from './tokens';

/** The line between two rows of one group: 1dp, quiet, never a sub-pixel haze. */
export function Divider() {
  return <View style={dividerStyles.line} accessibilityElementsHidden importantForAccessibility="no" />;
}

export const dividerStyles = StyleSheet.create({
  line: {
    height: nightStroke.quiet,
    backgroundColor: nightColors.divider,
  },
});
