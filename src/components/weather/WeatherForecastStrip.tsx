import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import type { WeatherDayForecast } from '../../weather/types';
import { conditionIconName } from '../../weather/codes';
import { formatTempC, formatWeekdayShort } from '../../weather/format';

/** Rain chance at or above this reads as "notable" and stops being quiet. */
export const RAIN_NOTABLE_PCT = 25;

/** Enough room for five stacked labels before the system font grows them. */
const STRIP_MIN_HEIGHT = 112;

interface Props {
  days: WeatherDayForecast[];
}

/**
 * The forecast row inside the weather peek: weekday · icon · high · low ·
 * rain% · humidity%.
 *
 * One coherent row, with the columns sharing the width evenly — it used to be
 * a fixed 52pt per day because it floated beside a draggable bubble and had to
 * know its own size in pixels. Inside a sheet it is just a block, so it takes
 * a height *floor* and grows with the system font instead.
 *
 * Humidity is skipped rather than dashed when a day has none: Open-Meteo has
 * no daily humidity variable, so a cache written before that was averaged from
 * the hourly series legitimately has nothing to show.
 */
export default function WeatherForecastStrip({ days }: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const outlineColor = isCartoon ? theme.colors.outline : theme.colors.outlineVariant;
  const outlineWidth = isCartoon ? deco.borderWidth : StyleSheet.hairlineWidth;

  return (
    <View
      style={[
        forecastStripStyles.strip,
        {
          borderRadius: deco.radius.lg,
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: outlineColor,
          borderWidth: outlineWidth,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {days.map((day, index) => {
        const rainNotable = day.precipProbabilityPct >= RAIN_NOTABLE_PCT;
        return (
          <View key={day.date} style={forecastStripStyles.dayCol}>
            {index > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  forecastStripStyles.dayDivider,
                  { backgroundColor: outlineColor },
                ]}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                forecastStripStyles.weekday,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {formatWeekdayShort(day.date)}
            </Text>
            <MaterialCommunityIcons
              name={conditionIconName(day.condition)}
              size={18}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              numberOfLines={1}
              style={[forecastStripStyles.hi, { color: theme.colors.onSurface }]}
            >
              {formatTempC(day.tempMaxC)}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                forecastStripStyles.lo,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {formatTempC(day.tempMinC)}
            </Text>
            <View style={forecastStripStyles.readingRow}>
              <MaterialCommunityIcons
                name="umbrella-outline"
                size={11}
                color={
                  rainNotable ? theme.colors.onSurface : theme.colors.onSurfaceVariant
                }
              />
              <Text
                numberOfLines={1}
                style={[
                  forecastStripStyles.reading,
                  {
                    color: rainNotable
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {`${day.precipProbabilityPct}%`}
              </Text>
            </View>
            {day.humidityMeanPct != null ? (
              <View style={forecastStripStyles.readingRow}>
                <MaterialCommunityIcons
                  name="water-percent"
                  size={11}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    forecastStripStyles.reading,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {`${day.humidityMeanPct}%`}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Exported so `fontScaling.test.ts` can hold this to `minHeight`, not `height`. */
export const forecastStripStyles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    minHeight: STRIP_MIN_HEIGHT,
    paddingHorizontal: space.xs,
  },
  dayCol: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingVertical: space.sm,
  },
  dayDivider: {
    position: 'absolute',
    left: 0,
    top: space.md,
    bottom: space.md,
    width: StyleSheet.hairlineWidth,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    textTransform: 'capitalize',
  },
  hi: {
    ...typeScale.data,
    fontSize: 13,
    lineHeight: 16,
  },
  lo: {
    ...typeScale.data,
    fontSize: 11,
    lineHeight: 14,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
  },
  reading: {
    ...typeScale.data,
    fontSize: 10,
    lineHeight: 13,
  },
});
