import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { clamp01 } from '../utils/clamp01';
import { useDoneFill } from './useDoneFill';

const MARK_SIZE = 44;
const ICON_SIZE = 22;
const ARC_STROKE = 3;
const ARC_RADIUS = (MARK_SIZE - ARC_STROKE) / 2;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

type Props = {
  icon: TrackerIconId;
  /** 0–1 of today's target, drawn as an arc round the disc while under way. */
  progress?: number | null;
  /** Done: the disc fills solid moss and the glyph turns filled. */
  complete?: boolean;
};

/**
 * A row's leading disc. At rest it is a quiet well with an outline glyph; done,
 * it floods moss — the one bold thing on Home. A timer or counter part of the
 * way to its target shows that share as a moss arc round the well.
 */
export function TrackerIdentityMark({ icon, progress = null, complete = false }: Props) {
  const theme = useTheme();
  const doneFill = useDoneFill(complete);
  const share = clamp01(progress ?? 0);
  const underWay = !complete && share > 0;

  return (
    <View style={[styles.disc, { backgroundColor: theme.colors.surfaceVariant }]}>
      {underWay ? (
        <Svg width={MARK_SIZE} height={MARK_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={MARK_SIZE / 2}
            cy={MARK_SIZE / 2}
            r={ARC_RADIUS}
            stroke={theme.colors.primary}
            strokeWidth={ARC_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${ARC_CIRCUMFERENCE} ${ARC_CIRCUMFERENCE}`}
            strokeDashoffset={ARC_CIRCUMFERENCE * (1 - share)}
            transform={`rotate(-90 ${MARK_SIZE / 2} ${MARK_SIZE / 2})`}
          />
        </Svg>
      ) : null}
      <TrackerIcon name={icon} size={ICON_SIZE} color={theme.colors.onSurfaceVariant} />
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: theme.colors.primary, opacity: doneFill }]}
      >
        <TrackerIcon name={icon} size={ICON_SIZE} color={theme.colors.onPrimary} filled />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    // Geometry: half the size is what makes it a circle.
    borderRadius: MARK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
