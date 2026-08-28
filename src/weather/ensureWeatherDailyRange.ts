import type { SQLiteDatabase } from 'expo-sqlite';
import * as weatherRepo from '../db/repositories/weatherRepository';
import { withDbWriteLock } from '../db/writeLock';
import { shiftDateString } from '../protocol';
import { useSettingsStore } from '../store/settingsStore';
import { fetchDailyWeatherRange } from './openMeteo';
import type { WeatherCoords, WeatherDailySnapshot } from './types';

function savedCoords(): WeatherCoords | null {
  const { weatherLat, weatherLon, weatherPlaceName } = useSettingsStore.getState();
  if (weatherLat == null || weatherLon == null) return null;
  return {
    lat: weatherLat,
    lon: weatherLon,
    placeName: weatherPlaceName ?? undefined,
  };
}

/**
 * Ensure weather_daily has rows for [sinceDate, untilDate].
 * Fills gaps via Open-Meteo when location is configured. Soft-fails offline.
 */
export async function ensureWeatherDailyRange(
  db: SQLiteDatabase,
  sinceDate: string,
  untilDate: string,
): Promise<WeatherDailySnapshot[]> {
  const existing = await weatherRepo.getWeatherDailyInRange(db, sinceDate, untilDate);
  const have = new Set(existing.map((s) => s.date));

  const missing: string[] = [];
  for (let date = sinceDate; date <= untilDate; date = shiftDateString(date, 1)) {
    if (!have.has(date)) missing.push(date);
  }

  if (missing.length === 0) return existing;

  const coords = savedCoords();
  if (!coords) return existing;

  try {
    const fetched = await fetchDailyWeatherRange(
      coords.lat,
      coords.lon,
      sinceDate,
      untilDate,
    );
    const fetchedAt = new Date().toISOString();
    const toInsert: WeatherDailySnapshot[] = [];
    for (const day of fetched) {
      if (have.has(day.date)) continue;
      toInsert.push({
        date: day.date,
        tempC: day.tempMeanC,
        tempMinC: day.tempMinC,
        tempMaxC: day.tempMaxC,
        weatherCode: day.weatherCode,
        condition: day.condition,
        precipProbabilityPct: day.precipProbabilityPct,
        lat: coords.lat,
        lon: coords.lon,
        fetchedAt,
      });
    }

    if (toInsert.length > 0) {
      await withDbWriteLock(async () => {
        for (const snapshot of toInsert) {
          await weatherRepo.upsertWeatherDaily(db, snapshot);
        }
      });
      for (const snapshot of toInsert) {
        existing.push(snapshot);
        have.add(snapshot.date);
      }
      existing.sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch (error) {
    console.warn(
      'Weather range backfill failed',
      error instanceof Error ? error.message : error,
    );
  }

  return existing;
}
