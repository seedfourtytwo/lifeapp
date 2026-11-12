import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { nightColors } from './tokens';

/**
 * The glass gradient, lit corner to dark corner, filling its parent. Drawn
 * with react-native-svg because React Native has no gradient fill of its own;
 * the parent clips it to its corners.
 */
export function GlassFill() {
  // `useId` gives ":r1:"; an SVG reference wants a plain name.
  const id = `glass${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={nightColors.glassTop} />
          <Stop offset="0.5" stopColor={nightColors.glassMiddle} />
          <Stop offset="1" stopColor={nightColors.glassBottom} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
