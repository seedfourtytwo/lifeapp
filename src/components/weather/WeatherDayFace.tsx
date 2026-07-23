import React from 'react';
import { StyleSheet, TextStyle, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import type { WeatherCondition, WeatherTrend } from '../../weather/types';
import {
  BUBBLE_HEIGHT,
  BUBBLE_RADIUS,
  BUBBLE_WIDTH,
} from '../../weather/bubblePosition';
import { conditionIconName } from '../../weather/codes';
import { formatBubbleDate, formatTempC } from '../../weather/format';
import { RAIN_NOTABLE_PCT, weatherMoodFor, type WeatherMoodVariant } from './weatherMood';

interface Props {
  condition: WeatherCondition;
  currentTempC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipProbabilityPct: number | null;
  trend?: WeatherTrend | null;
  /** Calendar day on the bottom row; defaults to today (DD/MM). */
  dateLabel?: string;
  muted?: boolean;
  offline?: boolean;
  error?: boolean;
}

/**
 * Centered three-line chip:
 *   now · condition · tendency
 *   high · low · rain
 *   date
 */
export default function WeatherDayFace({
  condition,
  currentTempC,
  tempMinC,
  tempMaxC,
  precipProbabilityPct,
  trend = null,
  dateLabel,
  muted = false,
  offline = false,
  error = false,
}: Props) {
  const moodVariant: WeatherMoodVariant = offline ? 'offline' : error ? 'error' : 'normal';
  const mood = weatherMoodFor(condition, {
    muted,
    variant: moodVariant,
    precipProbabilityPct,
  });

  const ink: TextStyle = {
    color: mood.ink,
    fontVariant: ['tabular-nums'],
  };
  const inkSoft: TextStyle = {
    color: mood.inkSoft,
    fontVariant: ['tabular-nums'],
  };

  const dateText = dateLabel ?? formatBubbleDate();
  const nowLabel = currentTempC != null ? formatTempC(currentTempC) : '—';
  const hasRange = tempMinC != null && tempMaxC != null;
  const hasRain = precipProbabilityPct != null;
  const rainNotable = hasRain && precipProbabilityPct >= RAIN_NOTABLE_PCT;
  const trendIcon =
    trend === 'improving' ? 'trending-up' : trend === 'worsening' ? 'trending-down' : null;
  const trendColor =
    trend === 'improving' ? mood.border : trend === 'worsening' ? mood.ink : mood.inkSoft;

  return (
    <View
      style={[
        styles.face,
        {
          width: BUBBLE_WIDTH,
          height: BUBBLE_HEIGHT,
          borderRadius: BUBBLE_RADIUS,
          backgroundColor: mood.fill,
          borderColor: mood.border,
          borderWidth: mood.borderWidth,
        },
      ]}
    >
      <View style={styles.row}>
        <Text numberOfLines={1} style={[ink, styles.nowTemp]}>
          {nowLabel}
        </Text>
        {moodVariant === 'normal' ? (
          <MaterialCommunityIcons
            name={conditionIconName(condition)}
            size={18}
            color={mood.border}
          />
        ) : (
          <MaterialCommunityIcons
            name={offline ? 'cloud-off-outline' : 'weather-cloudy-alert'}
            size={16}
            color={mood.inkSoft}
          />
        )}
        {trendIcon ? (
          <MaterialCommunityIcons name={trendIcon} size={14} color={trendColor} />
        ) : (
          <Text style={[inkSoft, styles.trendFlat]}>-</Text>
        )}
      </View>

      <View style={styles.row}>
        {hasRange ? (
          <>
            <Text numberOfLines={1} style={[ink, styles.hiText]}>
              {formatTempC(tempMaxC!)}
            </Text>
            <Text numberOfLines={1} style={[inkSoft, styles.loText]}>
              {formatTempC(tempMinC!)}
            </Text>
          </>
        ) : (
          <Text numberOfLines={1} style={[inkSoft, styles.loText]}>
            —
          </Text>
        )}
        {hasRain ? (
          <View style={styles.rainGroup}>
            <MaterialCommunityIcons
              name="water"
              size={11}
              color={rainNotable ? mood.ink : mood.inkSoft}
            />
            <Text
              numberOfLines={1}
              style={[
                rainNotable ? ink : inkSoft,
                styles.rainText,
                rainNotable ? styles.rainTextHot : null,
              ]}
            >
              {`${precipProbabilityPct}%`}
            </Text>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={1} style={[inkSoft, styles.dateLabel]}>
        {dateText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    gap: 4,
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rainGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 2,
  },
  nowTemp: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  hiText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  loText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  rainText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  rainTextHot: {
    fontWeight: '800',
  },
  trendFlat: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
    includeFontPadding: false,
  },
  dateLabel: {
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
