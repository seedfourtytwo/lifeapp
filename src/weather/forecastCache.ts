import { z } from 'zod';
import { getDatabase } from '../db/client';
import { withDbWriteLock } from '../db/writeLock';
import * as settingsRepo from '../db/repositories/settingsRepository';
import { getEventDataEpoch } from '../store/eventStore';
import { getWeatherDataEpoch } from './weatherEpoch';
import type { WeatherForecast } from './types';

/** Internal cache key — not part of protocol backup AppSettings. */
export const WEATHER_FORECAST_CACHE_KEY = 'weather_last_forecast';

const WeatherDayCacheSchema = z.object({
  date: z.string(),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  tempMeanC: z.number(),
  weatherCode: z.number(),
  condition: z.enum(['sunny', 'cloudy', 'rain', 'snow', 'other']),
  precipProbabilityPct: z.number(),
});

const WeatherForecastCacheSchema = z.object({
  currentTempC: z.number(),
  currentWeatherCode: z.number(),
  currentCondition: z.enum(['sunny', 'cloudy', 'rain', 'snow', 'other']),
  precipProbabilityPct: z.number(),
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
    return WeatherForecastCacheSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveCachedForecast(
  forecast: WeatherForecast,
  opts?: { epochAtStart?: number; weatherEpochAtStart?: number },
): Promise<boolean> {
  try {
    const epochAtStart = opts?.epochAtStart ?? getEventDataEpoch();
    const weatherEpochAtStart = opts?.weatherEpochAtStart ?? getWeatherDataEpoch();
    return await withDbWriteLock(async () => {
      if (
        epochAtStart !== getEventDataEpoch() ||
        weatherEpochAtStart !== getWeatherDataEpoch()
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
