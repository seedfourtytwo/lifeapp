import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { nightColors } from './tokens';

const [SKY_0, SKY_1, SKY_2, SKY_3] = nightColors.sky;

/** The night behind a full screen: sky down to the horizon, then the ground. Flat, no stars, no glow. */
export function NightBackground() {
  const id = `night${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SKY_0} />
          <Stop offset="0.22" stopColor={SKY_1} />
          <Stop offset="0.38" stopColor={SKY_2} />
          <Stop offset="0.46" stopColor={SKY_3} />
          <Stop offset="0.52" stopColor={nightColors.ground} />
          <Stop offset="1" stopColor={nightColors.ground} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
