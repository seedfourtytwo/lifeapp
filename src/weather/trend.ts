import type { WeatherCondition, WeatherTrend } from './types';
import { weatherCodeToCondition } from './codes';

/** Min precip swing (percentage points) before we call it a trend. */
const TREND_PRECIP_DELTA = 12;

/** Condition severity for near-term outlook (higher = worse). */
function conditionSeverity(condition: WeatherCondition): number {
  switch (condition) {
    case 'sunny':
      return 0;
    case 'cloudy':
      return 1;
    case 'other':
      return 2;
    case 'rain':
      return 3;
    case 'snow':
      return 4;
    case 'storm':
      return 5;
    default:
      return 2;
  }
}

function weatherCodeSeverity(code: number): number {
  return conditionSeverity(weatherCodeToCondition(code));
}

export interface HourlyTrendSample {
  time: string;
  weatherCode: number;
  precipProbabilityPct: number;
}

function parseHourMs(time: string): number | null {
  const t = Date.parse(time);
  return Number.isNaN(t) ? null : t;
}

function isSameLocalDay(time: string, now: Date): boolean {
  const ms = parseHourMs(time);
  if (ms == null) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Today's tendency: compare now to the rest of today's hours (fallback: next 3h).
 * Returns null when flat — omit the arrow rather than decorate.
 */
export function computeWeatherTrend(
  hourly: HourlyTrendSample[],
  now: Date = new Date(),
): WeatherTrend | null {
  if (hourly.length < 2) return null;

  const nowMs = now.getTime();
  let nowIndex = 0;
  for (let i = 0; i < hourly.length; i++) {
    const t = parseHourMs(hourly[i]!.time);
    if (t == null) continue;
    if (t <= nowMs) nowIndex = i;
    else break;
  }

  const current = hourly[nowIndex];
  if (!current) return null;

  const restOfDay = hourly
    .slice(nowIndex + 1)
    .filter((h) => isSameLocalDay(h.time, now));
  const ahead =
    restOfDay.length >= 2
      ? restOfDay
      : hourly.slice(nowIndex + 1, nowIndex + 4);
  if (ahead.length === 0) return null;

  const nowSev = weatherCodeSeverity(current.weatherCode);
  const nowPrecip = current.precipProbabilityPct;
  const avgSev =
    ahead.reduce((sum, h) => sum + weatherCodeSeverity(h.weatherCode), 0) / ahead.length;
  const avgPrecip =
    ahead.reduce((sum, h) => sum + h.precipProbabilityPct, 0) / ahead.length;

  const precipDelta = avgPrecip - nowPrecip;
  const sevDelta = avgSev - nowSev;

  const worsening = precipDelta >= TREND_PRECIP_DELTA || sevDelta >= 0.75;
  const improving = precipDelta <= -TREND_PRECIP_DELTA || sevDelta <= -0.75;

  if (worsening && !improving) return 'worsening';
  if (improving && !worsening) return 'improving';
  return null;
}
