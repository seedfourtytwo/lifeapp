import { i18n } from '../i18n';
import { conditionLabel } from './codes';
import { formatTempC } from './format';
import type { WeatherCondition, WeatherDayForecast, WeatherForecast } from './types';

/** What the header chip draws, and what it says out loud. */
export interface WeatherChipStatus {
  /** Glyph to draw. `other` stands in when there is nothing to draw yet. */
  condition: WeatherCondition;
  /** Temperature for the chip face, or an em dash while there is none. */
  tempLabel: string;
  hasForecast: boolean;
  /**
   * True when numbers are on screen but the last fetch failed — the chip is
   * showing yesterday's answer.
   */
  stale: boolean;
  /** Today's row, or the nearest one the forecast actually covers. */
  today: WeatherDayForecast | null;
  /**
   * One line covering condition, range, rain and direction of travel — read
   * out as the chip's accessibility label, and shown verbatim in the peek
   * when there is no forecast to draw.
   */
  summary: string;
}

export interface WeatherChipInput {
  forecast: WeatherForecast | null;
  loading: boolean;
  offline: boolean;
  /** Already-localized message from the weather store. */
  error: string | null;
  /** Today as `YYYY-MM-DD`, from the app calendar rather than raw wall time. */
  todayIso: string;
}

const NO_TEMP = '—';

/**
 * Everything the chip says, assembled away from the view.
 *
 * The chip itself is an icon and two digits, so all the branching lives here:
 * a phone with no forecast yet is a different sentence from one that is
 * offline, and one that is offline while still holding numbers is a third.
 */
export function weatherChipStatus({
  forecast,
  loading,
  offline,
  error,
  todayIso,
}: WeatherChipInput): WeatherChipStatus {
  if (!forecast) {
    return {
      condition: 'other',
      tempLabel: NO_TEMP,
      hasForecast: false,
      stale: false,
      today: null,
      summary:
        error ??
        (offline
          ? i18n.t('home:weatherChip.weatherOffline')
          : loading
            ? i18n.t('home:weatherChip.weatherLoading')
            : i18n.t('home:weatherChip.weatherUnavailable')),
    };
  }

  const today =
    forecast.daily.find((day) => day.date === todayIso) ?? forecast.daily[0] ?? null;

  const parts = [
    i18n.t('home:weatherChip.weatherWithCondition', {
      temp: formatTempC(forecast.currentTempC),
      condition: conditionLabel(forecast.currentCondition),
    }),
  ];
  if (today) {
    parts.push(`${formatTempC(today.tempMinC)}/${formatTempC(today.tempMaxC)}`);
  }
  const precipPct = today?.precipProbabilityPct ?? forecast.precipProbabilityPct;
  parts.push(i18n.t('home:weatherChip.rainChance', { pct: precipPct }));
  parts.push(
    forecast.trend === 'improving'
      ? i18n.t('home:weatherChip.trendImproving')
      : forecast.trend === 'worsening'
        ? i18n.t('home:weatherChip.trendWorsening')
        : i18n.t('home:weatherChip.trendSteady'),
  );

  return {
    condition: forecast.currentCondition,
    tempLabel: formatTempC(forecast.currentTempC),
    hasForecast: true,
    stale: offline || error != null,
    today,
    summary: parts.join('. '),
  };
}
