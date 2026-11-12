import React from 'react';
import { StyleSheet, View } from 'react-native';
import { clamp01 } from '../utils/clamp01';
import { nightColors, nightRadius, nightStroke, type NightLight } from './tokens';

type Props = {
  /** How far, 0 to 1. Outside that is held to the ends; nonsense is none. */
  value: number;
  light: NightLight;
  /** What it measures: "5 of 8 glasses". */
  accessibilityLabel: string;
};

/** A thin line in its light along an empty track: how far through the day's goal. */
export function ProgressLine({ value, light, accessibilityLabel }: Props) {
  const share = clamp01(value);
  return (
    <View
      style={progressLineStyles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
    >
      <View style={[progressLineStyles.fill, { width: `${share * 100}%`, backgroundColor: nightColors[light] }]} />
    </View>
  );
}

export const progressLineStyles = StyleSheet.create({
  track: {
    height: nightStroke.line,
    borderRadius: nightRadius.pill,
    overflow: 'hidden',
    backgroundColor: nightColors.track,
  },
  fill: {
    height: '100%',
  },
});
