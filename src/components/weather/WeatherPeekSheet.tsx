import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import HeaderPeekSheet from '../HeaderPeekSheet';
import QuietText from '../QuietText';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { conditionLabel } from '../../weather/codes';
import type { WeatherChipStatus } from '../../weather/chipStatus';
import type { WeatherForecast } from '../../weather/types';
import WeatherForecastStrip from './WeatherForecastStrip';

interface Props {
  visible: boolean;
  onClose: () => void;
  forecast: WeatherForecast | null;
  status: WeatherChipStatus;
  /** Where the forecast is for — the saved place, when there is one. */
  placeName: string | null;
}

/**
 * What the weather chip in the day header opens.
 *
 * Deliberately does not repeat the date: the header above it already says which
 * day this is, and the panel is about the next few of them.
 */
export default function WeatherPeekSheet({
  visible,
  onClose,
  forecast,
  status,
  placeName,
}: Props) {
  const { t } = useTranslation('home');

  const nowParts: string[] = [];
  if (forecast) {
    nowParts.push(status.tempLabel, conditionLabel(forecast.currentCondition));
    nowParts.push(
      t('weatherChip.rainChance', {
        pct: status.today?.precipProbabilityPct ?? forecast.precipProbabilityPct,
      }),
    );
    const humidityPct = forecast.currentHumidityPct ?? status.today?.humidityMeanPct;
    if (humidityPct != null) {
      nowParts.push(t('weatherChip.humidity', { pct: humidityPct }));
    }
  }

  const subtitleParts = [placeName, status.stale ? t('weatherChip.stale') : null].filter(
    (part): part is string => part != null && part.length > 0,
  );

  return (
    <HeaderPeekSheet
      visible={visible}
      onDismiss={onClose}
      title={t('weatherChip.forecastTitle')}
      subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : null}
      footer={
        <View style={styles.footer}>
          <Button mode="text" compact onPress={onClose}>
            {t('weatherChip.close')}
          </Button>
        </View>
      }
    >
      {forecast ? (
        <View style={styles.body}>
          <QuietText style={typeScale.meta}>{nowParts.join(' · ')}</QuietText>
          {forecast.daily.length > 0 ? (
            <WeatherForecastStrip days={forecast.daily} />
          ) : null}
        </View>
      ) : (
        <QuietText variant="bodyMedium">{status.summary}</QuietText>
      )}
    </HeaderPeekSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
  },
  footer: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
