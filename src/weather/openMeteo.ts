import { parseLocalDate } from '../protocol';
import { weatherCodeToCondition } from './codes';
import { fetchJsonWithTimeout } from './fetchJson';
import { computeWeatherTrend, type HourlyTrendSample } from './trend';
import type { WeatherDayForecast, WeatherForecast } from './types';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_COUNT = 10;

export interface GeocodeHit {
  id: number;
  name: string;
  lat: number;
  lon: number;
  country?: string;
  admin1?: string;
  population?: number;
  /** Display label: "Munich, Bavaria, Germany" */
  label: string;
}

interface GeocodeApiResult {
  results?: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    population?: number;
  }[];
}

interface ForecastApiResult {
  latitude: number;
  longitude: number;
  current?: {
    temperature_2m: number;
    weather_code: number;
    /** Present only when asked for; absent from the history range request. */
    relative_humidity_2m?: number | null;
  };
  hourly?: {
    time: string[];
    weather_code?: number[];
    precipitation_probability?: number[];
    /**
     * Open-Meteo publishes relative humidity hourly and as a `current` value —
     * there is no daily variable, so a per-day figure is averaged from these.
     */
    relative_humidity_2m?: (number | null)[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    temperature_2m_mean?: number[];
    precipitation_probability_max?: number[];
  };
}

export function formatGeocodeLabel(hit: {
  name: string;
  admin1?: string;
  country?: string;
}): string {
  return [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ');
}

/**
 * Open-Meteo often returns nothing for "City Country" — try a few query shapes.
 */
export function buildGeocodeQueries(raw: string): string[] {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return [];

  const queries: string[] = [];
  const push = (q: string) => {
    const next = q.trim().replace(/\s+/g, ' ');
    if (next.length >= 2 && !queries.includes(next)) queries.push(next);
  };

  push(trimmed);

  if (trimmed.includes(',')) {
    push(trimmed.split(',')[0] ?? '');
    push(trimmed.replace(/,/g, ' '));
  }

  const words = trimmed.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  if (words.length >= 2) {
    push(words.slice(0, -1).join(' '));
  }

  return queries;
}

function mapHits(data: GeocodeApiResult): GeocodeHit[] {
  const rows = data.results ?? [];
  return rows
    .map((hit) => ({
      id: hit.id,
      name: hit.name,
      lat: hit.latitude,
      lon: hit.longitude,
      country: hit.country,
      admin1: hit.admin1,
      population: hit.population,
      label: formatGeocodeLabel(hit),
    }))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
}

async function fetchGeocodePage(name: string): Promise<GeocodeHit[]> {
  const params = new URLSearchParams({
    name,
    count: String(GEOCODE_COUNT),
    format: 'json',
  });
  try {
    const data = (await fetchJsonWithTimeout(
      `${GEOCODE_URL}?${params.toString()}`,
    )) as GeocodeApiResult;
    return mapHits(data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('HTTP ')) {
      throw new Error(`Geocoding failed (${error.message.slice(5)})`);
    }
    throw error;
  }
}

/** Search places; returns up to ~10 matches so the user can pick the right city. */
export async function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const variants = buildGeocodeQueries(query);
  if (variants.length === 0) return [];

  const seen = new Set<number>();
  const merged: GeocodeHit[] = [];

  for (const variant of variants) {
    if (variant.length < 2) continue;
    const page = await fetchGeocodePage(variant);
    for (const hit of page) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      merged.push(hit);
    }
    if (merged.length >= GEOCODE_COUNT) break;
  }

  return merged
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, GEOCODE_COUNT);
}

export async function fetchForecast(lat: number, lon: number): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code,relative_humidity_2m',
    hourly: 'weather_code,precipitation_probability,relative_humidity_2m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_probability_max',
    forecast_days: '5',
    timezone: 'auto',
  });

  let data: ForecastApiResult;
  try {
    data = (await fetchJsonWithTimeout(
      `${FORECAST_URL}?${params.toString()}`,
    )) as ForecastApiResult;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('HTTP ')) {
      throw new Error(`Forecast failed (${error.message.slice(5)})`);
    }
    throw error;
  }

  if (!data.current || !data.daily?.time?.length) {
    throw new Error('Forecast response missing current or daily data');
  }

  const daily = mapDailyForecast(data.daily, meanHumidityByDay(data.hourly));
  const currentCode = data.current.weather_code;

  return {
    currentTempC: data.current.temperature_2m,
    currentWeatherCode: currentCode,
    currentCondition: weatherCodeToCondition(currentCode),
    currentHumidityPct: clampPct(data.current.relative_humidity_2m),
    precipProbabilityPct: daily[0]?.precipProbabilityPct ?? 0,
    trend: computeWeatherTrend(mapHourlyTrendSamples(data.hourly)),
    daily,
    lat: data.latitude,
    lon: data.longitude,
    fetchedAt: new Date().toISOString(),
  };
}

function mapHourlyTrendSamples(
  hourly: ForecastApiResult['hourly'],
): HourlyTrendSample[] {
  if (!hourly?.time?.length) return [];
  return hourly.time.map((time, index) => {
    const precipRaw = hourly.precipitation_probability?.[index] ?? 0;
    return {
      time,
      weatherCode: hourly.weather_code?.[index] ?? 0,
      precipProbabilityPct: Math.min(100, Math.max(0, Math.round(precipRaw))),
    };
  });
}

/** Round a 0–100 reading, or null when the API left it out. */
function clampPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Mean relative humidity per calendar day, keyed `YYYY-MM-DD`.
 *
 * Open-Meteo returns hourly stamps as local `YYYY-MM-DDTHH:mm`, so the day is
 * the first ten characters — no parsing, and no timezone to get wrong.
 */
function meanHumidityByDay(
  hourly: ForecastApiResult['hourly'],
): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  const samples = hourly?.relative_humidity_2m;
  if (!hourly?.time?.length || !samples?.length) return new Map();

  hourly.time.forEach((time, index) => {
    const pct = clampPct(samples[index]);
    if (pct == null) return;
    const day = time.slice(0, 10);
    const bucket = totals.get(day) ?? { sum: 0, count: 0 };
    bucket.sum += pct;
    bucket.count += 1;
    totals.set(day, bucket);
  });

  const means = new Map<string, number>();
  for (const [day, { sum, count }] of totals) {
    means.set(day, Math.round(sum / count));
  }
  return means;
}

function mapDailyForecast(
  daily: NonNullable<ForecastApiResult['daily']>,
  humidityByDay: Map<string, number> = new Map(),
): WeatherDayForecast[] {
  return daily.time.map((date, index) => {
    const weatherCode = daily.weather_code[index] ?? 0;
    const tempMinC = daily.temperature_2m_min[index] ?? 0;
    const tempMaxC = daily.temperature_2m_max[index] ?? 0;
    const tempMeanC =
      daily.temperature_2m_mean?.[index] ?? (tempMinC + tempMaxC) / 2;
    const precipRaw = daily.precipitation_probability_max?.[index] ?? 0;
    const precipProbabilityPct = Math.min(100, Math.max(0, Math.round(precipRaw)));
    return {
      date,
      tempMinC,
      tempMaxC,
      tempMeanC,
      weatherCode,
      condition: weatherCodeToCondition(weatherCode),
      precipProbabilityPct,
      humidityMeanPct: humidityByDay.get(date) ?? null,
    };
  });
}

function calendarDaysBetween(fromDate: string, toDate: string): number {
  const a = parseLocalDate(fromDate).getTime();
  const b = parseLocalDate(toDate).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

/**
 * Fetch daily weather covering [sinceDate, untilDate] using Open-Meteo past_days
 * (up to 92 days back from today). Returns only days inside the requested window.
 */
export async function fetchDailyWeatherRange(
  lat: number,
  lon: number,
  sinceDate: string,
  untilDate: string,
): Promise<WeatherDayForecast[]> {
  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const pastDays = Math.min(92, calendarDaysBetween(sinceDate, todayStr));
  const forecastDays = Math.min(
    16,
    Math.max(1, calendarDaysBetween(todayStr, untilDate) + 1),
  );

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_probability_max',
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    timezone: 'auto',
  });

  let data: ForecastApiResult;
  try {
    data = (await fetchJsonWithTimeout(
      `${FORECAST_URL}?${params.toString()}`,
    )) as ForecastApiResult;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('HTTP ')) {
      throw new Error(`Weather history failed (${error.message.slice(5)})`);
    }
    throw error;
  }

  if (!data.daily?.time?.length) {
    throw new Error('Weather history response missing daily data');
  }

  return mapDailyForecast(data.daily).filter(
    (day) => day.date >= sinceDate && day.date <= untilDate,
  );
}
