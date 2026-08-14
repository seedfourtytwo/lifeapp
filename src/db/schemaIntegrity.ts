import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  DEFAULT_JOURNAL_NOTEBOOK_NAME,
  joinJournalDayBodies,
  PROTOCOL_VERSION,
} from '../protocol';
import { newId } from '../utils/id';

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

async function tableColumns(db: SQLiteDatabase, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

async function seedDefaultJournalNotebook(db: SQLiteDatabase): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM journal_notebooks ORDER BY sort_order ASC, created_at ASC LIMIT 1',
  );
  if (existing) return existing.id;

  const id = newId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO journal_notebooks
      (id, name, color, icon, sort_order, created_at, protocol_version)
     VALUES (?, ?, ?, NULL, 0, ?, ?)`,
    id,
    DEFAULT_JOURNAL_NOTEBOOK_NAME,
    DEFAULT_JOURNAL_NOTEBOOK_COLOR,
    now,
    PROTOCOL_VERSION,
  );
  return id;
}

/** Journal notebooks catalog — repairs hot-reload / skipped migration cases. */
export async function ensureJournalNotebooksSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS journal_notebooks (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      protocol_version INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_journal_notebooks_sort ON journal_notebooks(sort_order);
  `);
  await seedDefaultJournalNotebook(db);
}

/**
 * Ensure daily_journals is one document per notebook per day.
 * Rebuilds pre-v16 tables that were UNIQUE(date) with no notebook_id.
 */
export async function ensureDailyJournalsSchema(db: SQLiteDatabase): Promise<void> {
  await ensureJournalNotebooksSchema(db);

  const columns = await tableColumns(db, 'daily_journals');
  if (columns.size > 0 && !columns.has('notebook_id')) {
    const notebookId = await seedDefaultJournalNotebook(db);
    await db.execAsync(`
      CREATE TABLE daily_journals_v16 (
        id TEXT PRIMARY KEY NOT NULL,
        notebook_id TEXT NOT NULL,
        date TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        protocol_version INTEGER NOT NULL,
        FOREIGN KEY (notebook_id) REFERENCES journal_notebooks(id),
        UNIQUE (notebook_id, date)
      );
    `);
    await db.runAsync(
      `INSERT INTO daily_journals_v16
        (id, notebook_id, date, body, created_at, updated_at, protocol_version)
       SELECT id, ?, date, body, updated_at, updated_at, protocol_version
       FROM daily_journals`,
      notebookId,
    );
    await db.execAsync('DROP TABLE daily_journals');
    await db.execAsync('ALTER TABLE daily_journals_v16 RENAME TO daily_journals');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_journals (
      id TEXT PRIMARY KEY NOT NULL,
      notebook_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      protocol_version INTEGER NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES journal_notebooks(id),
      UNIQUE (notebook_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_journals_date ON daily_journals(date);
  `);

  const nextColumns = await tableColumns(db, 'daily_journals');
  if (nextColumns.has('notebook_id')) {
    await mergeDuplicateJournalDays(db);
    await db.runAsync(`DELETE FROM daily_journals WHERE trim(body) = ''`);
    await db.execAsync('DROP INDEX IF EXISTS idx_daily_journals_notebook_date');
    await db.execAsync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_journals_notebook_date ON daily_journals(notebook_id, date)',
    );
  }
}

async function mergeDuplicateJournalDays(db: SQLiteDatabase): Promise<void> {
  const groups = await db.getAllAsync<{ notebook_id: string; date: string }>(
    `SELECT notebook_id, date FROM daily_journals
     GROUP BY notebook_id, date HAVING COUNT(*) > 1`,
  );
  for (const group of groups) {
    const rows = await db.getAllAsync<{
      id: string;
      body: string;
      updated_at: string;
    }>(
      `SELECT id, body, updated_at FROM daily_journals
       WHERE notebook_id = ? AND date = ?
       ORDER BY created_at ASC, updated_at ASC`,
      group.notebook_id,
      group.date,
    );
    if (rows.length < 2) continue;
    const keep = rows[0];
    if (!keep) continue;
    const body = joinJournalDayBodies(rows.map((row) => row.body));
    if (!body.trim()) {
      for (const row of rows) {
        await db.runAsync('DELETE FROM daily_journals WHERE id = ?', row.id);
      }
      continue;
    }
    const last = rows[rows.length - 1];
    await db.runAsync(
      'UPDATE daily_journals SET body = ?, updated_at = ? WHERE id = ?',
      body,
      last?.updated_at ?? keep.updated_at,
      keep.id,
    );
    for (const extra of rows.slice(1)) {
      await db.runAsync('DELETE FROM daily_journals WHERE id = ?', extra.id);
    }
  }
}

/** Local share fingerprint for notes/journals — not protocol, not backed up. */
export async function ensureNoteShareStateSchema(db: SQLiteDatabase): Promise<void> {
  const columns = await tableColumns(db, 'note_share_state');
  if (columns.size > 0 && !columns.has('entry_id')) {
    await db.execAsync(`
      CREATE TABLE note_share_state_v16 (
        kind TEXT NOT NULL,
        element_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        date TEXT NOT NULL,
        body_fp TEXT NOT NULL,
        shared_at TEXT NOT NULL,
        PRIMARY KEY (kind, element_id, entry_id, date)
      );
    `);
    await db.execAsync(`
      INSERT INTO note_share_state_v16
        (kind, element_id, entry_id, date, body_fp, shared_at)
      SELECT
        s.kind,
        s.element_id,
        CASE
          WHEN s.kind = 'journal' THEN COALESCE(
            (SELECT j.id FROM daily_journals j WHERE j.date = s.date LIMIT 1),
            ''
          )
          ELSE ''
        END,
        s.date,
        s.body_fp,
        s.shared_at
      FROM note_share_state s;
    `);
    await db.execAsync(`
      DROP TABLE note_share_state;
      ALTER TABLE note_share_state_v16 RENAME TO note_share_state;
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS note_share_state (
      kind TEXT NOT NULL,
      element_id TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body_fp TEXT NOT NULL,
      shared_at TEXT NOT NULL,
      PRIMARY KEY (kind, element_id, entry_id, date)
    );
  `);
}
