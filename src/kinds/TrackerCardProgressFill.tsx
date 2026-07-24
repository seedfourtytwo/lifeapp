import React from 'react';
import { StyleSheet, View } from 'react-native';
import { withHexAlpha } from '../utils/color';
import { clamp01 } from '../utils/clamp01';

type Props = {
  progress: number;
  /** Accent used for the soft wash + leading edge. */
  color: string;
  borderRadius: number;
};

/**
 * Soft left-to-right progress wash inside the card (under content).
 * Outer card border stays identical whether progress is present or not.
 */
export function TrackerCardProgressFill({
  progress,
  color,
  borderRadius,
}: Props) {
  const t = clamp01(progress);
  if (t <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.clip, { borderRadius }]}
      accessible={false}
      importantForAccessibility="no"
    >
      <View
        style={[
          styles.wash,
          {
            width: `${t * 100}%`,
            backgroundColor: withHexAlpha(color, 0.16),
          },
        ]}
      >
        <View
          style={[
            styles.edge,
            { backgroundColor: withHexAlpha(color, 0.42) },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  wash: {
    height: '100%',
    position: 'relative',
  },
  edge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 3,
  },
});
