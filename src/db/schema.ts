export const DB_NAME = 'lifeapp.db';

/**
 * Lean Life Protocol v1 + ambient tables.
 * No unused columns (category/parent_id/overrides). Fresh installs and schema v12+ wipe.
 *
 * Boot-safe: this string runs on every open, including pre-v16 databases.
 * Do not index daily_journals(notebook_id) here — that column exists only after
 * ensureDailyJournalsSchema rebuilds the old UNIQUE(date) table.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS dashboard_items (
  id TEXT PRIMARY KEY NOT NULL,
  element_id TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  element_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  meta_json TEXT,
  protocol_version INTEGER NOT NULL,
  FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_element_date ON events(element_id, date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

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

CREATE TABLE IF NOT EXISTS daily_journals (
  id TEXT PRIMARY KEY NOT NULL,
  notebook_id TEXT NOT NULL,
  date TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  -- No ON DELETE cascade on purpose: deleting a notebook must reassign its
  -- entries first (see journalNotebooks.ts deleteJournalNotebook). Silently
  -- cascading here would delete journal text; let the FK check fail loudly
  -- if a future code path deletes a notebook without reassigning.
  FOREIGN KEY (notebook_id) REFERENCES journal_notebooks(id),
  UNIQUE (notebook_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_journals_date ON daily_journals(date);

CREATE TABLE IF NOT EXISTS note_share_state (
  kind TEXT NOT NULL,
  element_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  date TEXT NOT NULL,
  body_fp TEXT NOT NULL,
  shared_at TEXT NOT NULL,
  PRIMARY KEY (kind, element_id, entry_id, date)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

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
`;
