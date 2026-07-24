import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { clamp01 } from '../utils/clamp01';
import { StreakFireCount } from './StreakFireCount';

const MARK_SIZE = 44;
const RING_STROKE = 2.75;
const RING_RADIUS = (MARK_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Props = {
  icon: TrackerIconId;
  /** 0–1 fill for the outer ring; omit to show track only. */
  progress?: number | null;
  /** When true, ring/well use the complete accent. */
  complete?: boolean;
  streakDays?: number | null;
};

/**
 * Home leading mark: icon in a well with an optional progress ring and streak badge.
 */
export function TrackerIdentityMark({
  icon,
  progress = null,
  complete = false,
  streakDays = null,
}: Props) {
  const theme = useTheme();
  const fill = clamp01(progress ?? (complete ? 1 : 0));
  const streakDaysShown =
    typeof streakDays === 'number' && streakDays > 0 ? streakDays : null;
  const accent = theme.colors.primary;
  const track = theme.colors.outlineVariant;
  const wellBg = complete
    ? `${theme.colors.primary}22`
    : theme.colors.surfaceVariant;
  const iconColor = complete ? theme.colors.primary : theme.colors.onSurface;

  return (
    <View style={styles.wrap}>
      <View style={styles.mark}>
        <Svg width={MARK_SIZE} height={MARK_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={MARK_SIZE / 2}
            cy={MARK_SIZE / 2}
            r={RING_RADIUS}
            stroke={track}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {fill > 0 ? (
            <Circle
              cx={MARK_SIZE / 2}
              cy={MARK_SIZE / 2}
              r={RING_RADIUS}
              stroke={accent}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - fill)}
              transform={`rotate(-90 ${MARK_SIZE / 2} ${MARK_SIZE / 2})`}
            />
          ) : null}
        </Svg>
        <View style={[styles.well, { backgroundColor: wellBg }]}>
          <TrackerIcon name={icon} size={22} color={iconColor} />
        </View>
      </View>
      {streakDaysShown != null ? (
        <StreakFireCount
          days={streakDaysShown}
          color={theme.colors.primary}
          variant="badge"
          badgeBackgroundColor={theme.colors.primaryContainer}
          badgeBorderColor={theme.colors.surface}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  well: {
    width: MARK_SIZE - RING_STROKE * 2 - 4,
    height: MARK_SIZE - RING_STROKE * 2 - 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
