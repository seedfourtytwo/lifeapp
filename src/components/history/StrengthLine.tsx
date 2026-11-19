import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import QuietText from '../QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { strengthLinePoints } from './strengthLinePoints';
import { STRENGTH_LINE_DAYS } from './yearReview';

const HEIGHT = 56;
const LINE_WIDTH = 2;
const END_DOT_RADIUS = 3;
/** Keeps the stroke and the end dot inside the plot. */
const INSET = END_DOT_RADIUS + 1;

type Props = {
  /** The score after each day, oldest first; the last is the score now. */
  scores: readonly number[];
  caption: string;
  accessibilityLabel: string;
};

/**
 * How a tracker's strength got to where it is: one accent line over the last
 * 90 days on a flat baseline at zero, ending in a dot labelled with the score
 * now. No axis — the figure above it is the reading; this is its shape.
 */
export default function StrengthLine({ scores, caption, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { decorations: deco, palette } = useAppTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== width) setWidth(next);
  };

  const points = strengthLinePoints(scores, STRENGTH_LINE_DAYS, width, HEIGHT, INSET);
  const end = points[points.length - 1];
  const labelHeight = typeScale.timer.lineHeight;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.row}>
        <View style={styles.plot} onLayout={onLayout}>
          <Svg width={width} height={HEIGHT}>
            <Rect
              x={0}
              y={HEIGHT - INSET}
              width={width}
              height={deco.borderWidth}
              fill={theme.colors.surfaceVariant}
            />
            <Polyline
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={palette.accent}
              strokeWidth={LINE_WIDTH}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {end ? <Circle cx={end.x} cy={end.y} r={END_DOT_RADIUS} fill={palette.accent} /> : null}
          </Svg>
        </View>
        {end ? (
          <Text
            style={[
              typeScale.timer,
              {
                color: palette.accent,
                // Level with the end dot, kept inside the plot's height.
                marginTop: Math.min(HEIGHT - labelHeight, Math.max(0, end.y - labelHeight / 2)),
              },
            ]}
          >
            {scores[scores.length - 1]}
          </Text>
        ) : null}
      </View>
      <QuietText style={typeScale.caption}>{caption}</QuietText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    minHeight: HEIGHT,
  },
  plot: {
    flex: 1,
    minWidth: 0,
  },
});
