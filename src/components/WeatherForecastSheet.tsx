import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import { toDateString } from '../protocol';
import { useWeatherStore } from '../store/weatherStore';
import { conditionIconName } from '../weather/codes';
import { formatDayLabel, formatTempC } from '../weather/format';

interface Props {
  onClose: () => void;
}

/** Bottom sheet body for the 5-day forecast (used by Home chrome bubble). */
export default function WeatherForecastSheet({ onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { decorations: deco, isCartoon } = useAppTheme();
  const accent = isCartoon ? theme.colors.secondary : theme.colors.primary;
  const forecast = useWeatherStore((s) => s.forecast);
  const error = useWeatherStore((s) => s.error);
  const offline = useWeatherStore((s) => s.offline);
  const hasForecast = forecast != null;
  const todayForecast = forecast?.daily.find((d) => d.date === toDateString(new Date()));

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: deco.radius.lg,
          borderTopRightRadius: deco.radius.lg,
          ...(isCartoon && {
            borderTopWidth: deco.headerBorderWidth,
            borderColor: theme.colors.outline,
          }),
        },
      ]}
    >
      <Text
        variant="titleMedium"
        style={[styles.title, isCartoon && { color: theme.colors.onSurface }]}
      >
        {t('weatherForecast.title')}
      </Text>
      {offline ? (
        <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 4 }}>
          {t('weatherForecast.offlineNotice')}
        </Text>
      ) : null}
      {hasForecast ? (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
        >
          {t('weatherForecast.nowLabel', { temp: formatTempC(forecast.currentTempC) })}
          {todayForecast
            ? t('weatherForecast.todayRange', {
                min: Math.round(todayForecast.tempMinC),
                max: Math.round(todayForecast.tempMaxC),
              })
            : ''}
        </Text>
      ) : null}
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
      >
        {t('weatherForecast.subtitle')}
      </Text>
      {forecast?.daily.length ? (
        forecast.daily.slice(0, 5).map((day) => (
          <View key={day.date} style={styles.dayRow}>
            <MaterialCommunityIcons
              name={conditionIconName(day.condition)}
              size={20}
              color={accent}
            />
            <Text variant="bodyMedium" style={styles.dayDate}>
              {formatDayLabel(day.date)}
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.dayRain, { color: theme.colors.onSurfaceVariant }]}
            >
              {day.precipProbabilityPct}%
            </Text>
            <Text variant="bodyMedium" style={styles.dayTemps}>
              {Math.round(day.tempMinC)}° / {Math.round(day.tempMaxC)}°
            </Text>
          </View>
        ))
      ) : (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {error ?? t('weatherForecast.emptyFallback')}
        </Text>
      )}
      <Pressable
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel={t('weatherForecast.close')}
      >
        <Text variant="labelLarge" style={{ color: accent }}>
          {t('weatherForecast.close')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    marginBottom: 4,
    fontWeight: '700',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  dayDate: {
    flex: 1,
    fontWeight: '600',
  },
  dayRain: {
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  dayTemps: {
    fontVariant: ['tabular-nums'],
    minWidth: 72,
    textAlign: 'right',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 4,
  },
});
