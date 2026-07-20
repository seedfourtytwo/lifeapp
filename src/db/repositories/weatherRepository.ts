import type { SQLiteDatabase } from 'expo-sqlite';
import type { WeatherCondition, WeatherDailySnapshot } from '../../weather/types';

interface WeatherDailyRow {
  date: string;
  temp_c: number;
  temp_min_c: number;
  temp_max_c: number;
  weather_code: number;
  condition: string;
  precip_probability: number | null;
  lat: number | null;
  lon: number | null;
  fetched_at: string;
}

function rowToSnapshot(row: WeatherDailyRow): WeatherDailySnapshot {
  return {
    date: row.date,
    tempC: row.temp_c,
    tempMinC: row.temp_min_c,
    tempMaxC: row.temp_max_c,
    weatherCode: row.weather_code,
    condition: row.condition as WeatherCondition,
    precipProbabilityPct: row.precip_probability,
    lat: row.lat,
    lon: row.lon,
    fetchedAt: row.fetched_at,
  };
}

export async function upsertWeatherDaily(
  db: SQLiteDatabase,
  snapshot: WeatherDailySnapshot,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO weather_daily (
      date, temp_c, temp_min_c, temp_max_c, weather_code, condition,
      precip_probability, lat, lon, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      temp_c = excluded.temp_c,
      temp_min_c = excluded.temp_min_c,
      temp_max_c = excluded.temp_max_c,
      weather_code = excluded.weather_code,
      condition = excluded.condition,
      precip_probability = excluded.precip_probability,
      lat = excluded.lat,
      lon = excluded.lon,
      fetched_at = excluded.fetched_at`,
    snapshot.date,
    snapshot.tempC,
    snapshot.tempMinC,
    snapshot.tempMaxC,
    snapshot.weatherCode,
    snapshot.condition,
    snapshot.precipProbabilityPct,
    snapshot.lat,
    snapshot.lon,
    snapshot.fetchedAt,
  );
}

export async function getWeatherDaily(
  db: SQLiteDatabase,
  date: string,
): Promise<WeatherDailySnapshot | null> {
  const row = await db.getFirstAsync<WeatherDailyRow>(
    `SELECT date, temp_c, temp_min_c, temp_max_c, weather_code, condition,
            precip_probability, lat, lon, fetched_at
     FROM weather_daily WHERE date = ?`,
    date,
  );
  return row ? rowToSnapshot(row) : null;
}

export async function clearWeatherDaily(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM weather_daily');
}
