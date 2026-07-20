import type { SQLiteDatabase } from 'expo-sqlite';

/** Ensure `elements.archived_at` exists — repairs DBs where schema_version advanced without the column. */
export async function ensureElementsSchema(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(elements)');
  if (!columns.some((column) => column.name === 'archived_at')) {
    await db.execAsync('ALTER TABLE elements ADD COLUMN archived_at TEXT');
  }
}

/** Ensure weather_daily exists with precip_probability — repairs hot-reload / skipped migration cases. */
export async function ensureWeatherDailySchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS weather_daily (
      date TEXT PRIMARY KEY NOT NULL,
      temp_c REAL NOT NULL,
      temp_min_c REAL NOT NULL,
      temp_max_c REAL NOT NULL,
      weather_code INTEGER NOT NULL,
      condition TEXT NOT NULL,
      precip_probability INTEGER,
      lat REAL,
      lon REAL,
      fetched_at TEXT NOT NULL
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(weather_daily)');
  if (!columns.some((column) => column.name === 'precip_probability')) {
    await db.execAsync('ALTER TABLE weather_daily ADD COLUMN precip_probability INTEGER');
  }
}
