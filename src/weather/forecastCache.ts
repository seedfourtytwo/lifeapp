import { z } from 'zod';
import { getDatabase } from '../db/client';
import { getDataGeneration } from '../db/dataGeneration';
import { withDbWriteLock } from '../db/writeLock';
import * as settingsRepo from '../db/repositories/settingsRepository';
import type { WeatherForecast } from './types';

/** Internal cache key — not part of protocol backup AppSettings. */
export const WEATHER_FORECAST_CACHE_KEY = 'weather_last_forecast';

const WeatherDayCacheSchema = z.object({
  date: z.string(),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  tempMeanC: z.number(),
  weatherCode: z.number(),
  condition: z.enum(['sunny', 'cloudy', 'rain', 'storm', 'snow', 'other']),
  precipProbabilityPct: z.number(),
  humidityMeanPct: z.number().nullable().optional(),
});

/**
 * Exported for the tests that pin one property: a forecast cached by an older
 * build has no humidity in it, and it still has to parse. Throwing there would
 * silently wipe the cache and leave an offline phone with no weather at all,
 * which is the one situation the cache exists for.
 */
export const WeatherForecastCacheSchema = z.object({
  currentTempC: z.number(),
  currentWeatherCode: z.number(),
  currentCondition: z.enum(['sunny', 'cloudy', 'rain', 'storm', 'snow', 'other']),
  currentHumidityPct: z.number().nullable().optional(),
  precipProbabilityPct: z.number(),
  trend: z.enum(['improving', 'worsening']).nullable().optional(),
  daily: z.array(WeatherDayCacheSchema).min(1),
  lat: z.number(),
  lon: z.number(),
  fetchedAt: z.string(),
});

export async function loadCachedForecast(): Promise<WeatherForecast | null> {
  try {
    const db = await getDatabase();
    const raw = await settingsRepo.getSetting(db, WEATHER_FORECAST_CACHE_KEY);
    if (!raw) return null;
    const parsed = WeatherForecastCacheSchema.parse(JSON.parse(raw));
    return {
      ...parsed,
      trend: parsed.trend ?? null,
      currentHumidityPct: parsed.currentHumidityPct ?? null,
      daily: parsed.daily.map((day) => ({
        ...day,
        humidityMeanPct: day.humidityMeanPct ?? null,
      })),
    };
  } catch {
    return null;
  }
}

export async function saveCachedForecast(
  forecast: WeatherForecast,
  opts?: { epochAtStart?: number; weatherEpochAtStart?: number },
): Promise<boolean> {
  try {
    const epochAtStart = opts?.epochAtStart ?? getDataGeneration('protocol');
    const weatherEpochAtStart = opts?.weatherEpochAtStart ?? getDataGeneration('weather');
    return await withDbWriteLock(async () => {
      if (
        epochAtStart !== getDataGeneration('protocol') ||
        weatherEpochAtStart !== getDataGeneration('weather')
      ) {
        return false;
      }
      const db = await getDatabase();
      await settingsRepo.setSetting(
        db,
        WEATHER_FORECAST_CACHE_KEY,
        JSON.stringify(forecast),
      );
      return true;
    });
  } catch (error) {
    console.error('Failed to cache weather forecast', error);
    return false;
  }
}

export async function clearCachedForecast(): Promise<void> {
  try {
    await withDbWriteLock(async () => {
      const db = await getDatabase();
      await settingsRepo.deleteSetting(db, WEATHER_FORECAST_CACHE_KEY);
    });
  } catch {
    // ignore
  }
}
