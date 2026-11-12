import React, { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { nightColors } from './tokens';

/**
 * The glass gradient, lit corner to dark corner, filling its parent. Drawn
 * with react-native-svg because React Native has no gradient fill of its own;
 * the parent clips it to its corners.
 *
 * The drawing is given its parent's measured size in numbers: on Android a
 * percentage-sized Svg paints short of the right and top edges.
 */
export function GlassFill() {
  // `useId` gives ":r1:"; an SVG reference wants a plain name.
  const id = `glass${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current && current.width === width && current.height === height ? current : { width, height },
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={nightColors.glassTop} />
              <Stop offset="0.5" stopColor={nightColors.glassMiddle} />
              <Stop offset="1" stopColor={nightColors.glassBottom} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}
