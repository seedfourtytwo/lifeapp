import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import type { WeatherDayForecast } from '../../weather/types';
import {
  STRIP_DAY_WIDTH,
  STRIP_HEIGHT,
  STRIP_PAD_H,
  forecastStripWidth,
} from '../../weather/bubblePosition';
import { conditionIconName } from '../../weather/codes';
import { formatTempC, formatWeekdayShort } from '../../weather/format';
import { RAIN_NOTABLE_PCT, weatherMoodFor } from './weatherMood';

interface Props {
  days: WeatherDayForecast[];
}

/**
 * Expanded forecast strip: weekday · icon · high · low · rain%.
 * One coherent row (Apple Daily Forecast pattern), not floating chips.
 */
export default function WeatherForecastStrip({ days }: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const outlineColor = isCartoon ? theme.colors.outline : theme.colors.outlineVariant;
  const outlineWidth = isCartoon ? deco.borderWidth : StyleSheet.hairlineWidth;
  const width = forecastStripWidth(days.length);

  return (
    <View
      style={[
        styles.strip,
        {
          width,
          height: STRIP_HEIGHT,
          borderRadius: deco.radius.xl,
          backgroundColor: theme.colors.surface,
          borderColor: outlineColor,
          borderWidth: outlineWidth,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {days.map((day, index) => {
        const mood = weatherMoodFor(day.condition, {
          precipProbabilityPct: day.precipProbabilityPct,
        });
        const rainHot = day.precipProbabilityPct >= RAIN_NOTABLE_PCT;
        return (
          <View key={day.date} style={[styles.dayCol, { width: STRIP_DAY_WIDTH }]}>
            {index > 0 ? (
              <View
                pointerEvents="none"
                style={[styles.dayDivider, { backgroundColor: theme.colors.outlineVariant }]}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.weekday, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatWeekdayShort(day.date)}
            </Text>
            <MaterialCommunityIcons
              name={conditionIconName(day.condition)}
              size={18}
              color={mood.border}
            />
            <Text numberOfLines={1} style={[styles.hi, { color: theme.colors.onSurface }]}>
              {formatTempC(day.tempMaxC)}
            </Text>
            <Text numberOfLines={1} style={[styles.lo, { color: theme.colors.onSurfaceVariant }]}>
              {formatTempC(day.tempMinC)}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.rain,
                { color: rainHot ? mood.ink : theme.colors.onSurfaceVariant },
              ]}
            >
              {`${day.precipProbabilityPct}%`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    paddingHorizontal: STRIP_PAD_H,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  dayCol: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  dayDivider: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: StyleSheet.hairlineWidth,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    textTransform: 'capitalize',
  },
  hi: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  lo: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
  },
  rain: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
