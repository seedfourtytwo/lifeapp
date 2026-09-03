import React, { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import CalendarPeekSheet from '../../components/CalendarPeekSheet';
import WeatherPeekSheet from '../../components/weather/WeatherPeekSheet';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/settingsStore';
import { useWeatherStore } from '../../store/weatherStore';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { conditionIconName } from '../../weather/codes';
import { weatherChipStatus } from '../../weather/chipStatus';
import { currentAppCalendarDate } from '../../utils/dayRollover';

interface Props {
  /** Calendar "now" from the header, so the chip and the date agree on the day. */
  now: Date;
}

/**
 * The two things that sit beside the date on every Home tab: what the weather
 * is, and whether anything is coming up.
 *
 * Both are one glyph that opens the same kind of small panel. They live inside
 * `DayHeader` rather than being passed in through its `actions` slot, because
 * that slot is already taken on four of the five tabs and these two belong to
 * the header itself, not to whichever tab is showing.
 *
 * The calendar glyph is unconditional: it reads nothing until it is tapped, so
 * there is no cost to switch off. Weather keeps its switch — it fetches.
 */
export default function DayHeaderPeeks({ now }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { isCartoon } = useAppTheme();
  const weatherEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const placeName = useSettingsStore((s) => s.weatherPlaceName);
  const forecast = useWeatherStore((s) => s.forecast);
  const loading = useWeatherStore((s) => s.loading);
  const offline = useWeatherStore((s) => s.offline);
  const error = useWeatherStore((s) => s.error);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const status = weatherChipStatus({
    forecast,
    loading,
    offline,
    error,
    todayIso: currentAppCalendarDate(now),
  });

  const accent = isCartoon ? theme.colors.secondary : theme.colors.primary;

  const toggleWeather = (open: boolean) => {
    setWeatherOpen(open);
    AccessibilityInfo.announceForAccessibility(
      open ? t('weatherChip.forecastExpanded') : t('weatherChip.forecastCollapsed'),
    );
  };

  return (
    <>
      <View style={styles.row}>
        {weatherEnabled ? (
          <Pressable
            onPress={() => toggleWeather(true)}
            hitSlop={space.sm}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={status.summary}
            accessibilityHint={t('weatherChip.tapToExpandForecast')}
          >
            <MaterialCommunityIcons
              name={conditionIconName(status.condition)}
              size={18}
              color={status.hasForecast ? theme.colors.onSurface : theme.colors.outline}
            />
            <Text
              style={[
                styles.temp,
                {
                  color: status.hasForecast
                    ? theme.colors.onSurface
                    : theme.colors.onSurfaceVariant,
                },
              ]}
              numberOfLines={1}
            >
              {status.tempLabel}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setCalendarOpen(true)}
          hitSlop={space.sm}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={t('calendarPeek.openCalendar')}
        >
          <MaterialCommunityIcons name="calendar-blank-outline" size={20} color={accent} />
        </Pressable>
      </View>

      {weatherEnabled ? (
        <WeatherPeekSheet
          visible={weatherOpen}
          onClose={() => toggleWeather(false)}
          forecast={forecast}
          status={status}
          placeName={placeName}
        />
      ) : null}

      <CalendarPeekSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    // A floor, not a fixed size: the temperature is text and may grow.
    minHeight: 32,
    minWidth: 32,
    justifyContent: 'center',
  },
  temp: {
    ...typeScale.data,
    fontSize: 15,
    lineHeight: 19,
  },
});
