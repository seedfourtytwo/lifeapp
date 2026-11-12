import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { ROAD_BOX, roadScene, shownCarAt, type RoadSceneInput } from './roadScene';
import { nightColors } from './tokens';

type Props = RoadSceneInput & {
  /** What the picture says, for a screen reader. */
  accessibilityLabel: string;
};

/**
 * The road picture. Nothing in it animates: the caller redraws it as the
 * clock moves the car, so it cannot drift from the time; under reduced
 * motion the car moves in whole steps.
 */
export function Road({ carAt, lampAt = null, dashes, accessibilityLabel }: Props) {
  const reduceMotion = useReduceMotion();
  const scene = roadScene({ carAt: shownCarAt(carAt, lampAt, reduceMotion), lampAt, dashes });
  return (
    <View style={roadStyles.box} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${ROAD_BOX.width} ${ROAD_BOX.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Polygon points={scene.road} fill={nightColors.asphalt} />
        {scene.dashes.map((dash, index) => (
          <Line
            key={index}
            x1={dash.x1}
            y1={dash.y1}
            x2={dash.x2}
            y2={dash.y2}
            stroke={nightColors.cream}
            strokeOpacity={dash.level}
            strokeWidth={dash.width}
          />
        ))}
        {scene.lamp ? (
          <>
            <Line
              x1={scene.lamp.post.x1}
              y1={scene.lamp.post.y1}
              x2={scene.lamp.post.x2}
              y2={scene.lamp.post.y2}
              stroke={nightColors.lampPost}
              strokeWidth={scene.lamp.post.width}
            />
            <Circle {...scene.lamp.light} fill={nightColors.lamp} />
          </>
        ) : null}
        {scene.tailLights.map((light, index) => (
          <Circle key={index} {...light} fill={nightColors.tail} />
        ))}
      </Svg>
    </View>
  );
}

export const roadStyles = StyleSheet.create({
  box: {
    width: '100%',
    aspectRatio: ROAD_BOX.width / ROAD_BOX.height,
  },
});
