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

/** Ensure ambient calendar tables exist — repairs hot-reload / skipped migration cases. */
export async function ensureCalendarSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY NOT NULL,
      calendar_id TEXT NOT NULL,
      uid TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      notes TEXT,
      event_type TEXT NOT NULL,
      all_day INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      timezone TEXT NOT NULL,
      rrule TEXT,
      FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar ON calendar_events(calendar_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);

    CREATE TABLE IF NOT EXISTS calendar_reminders (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      offset_minutes INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event ON calendar_reminders(event_id);

    CREATE TABLE IF NOT EXISTS calendar_occurrence_clears (
      occurrence_key TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      cleared_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_occurrence_clears_event ON calendar_occurrence_clears(event_id);
  `);
}

/** Ensure day_notes exists — repairs hot-reload / skipped migration cases. */
export async function ensureDayNotesSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS day_notes (
      id TEXT PRIMARY KEY NOT NULL,
      element_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      protocol_version INTEGER NOT NULL,
      FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE,
      UNIQUE (element_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_day_notes_element_date ON day_notes(element_id, date);
  `);

  // Drop orphans left behind if foreign_keys were off during an older wipe.
  await db.runAsync(
    'DELETE FROM day_notes WHERE element_id NOT IN (SELECT id FROM elements)',
  );
}

/** Ensure daily_journals exists — repairs hot-reload / skipped migration cases. */
export async function ensureDailyJournalsSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_journals (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      protocol_version INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_daily_journals_date ON daily_journals(date);
  `);
}

/** Local share fingerprint for notes/journals — not protocol, not backed up. */
export async function ensureNoteShareStateSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS note_share_state (
      kind TEXT NOT NULL,
      element_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body_fp TEXT NOT NULL,
      shared_at TEXT NOT NULL,
      PRIMARY KEY (kind, element_id, date)
    );
  `);
}
