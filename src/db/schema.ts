export const DB_NAME = 'lifeapp.db';

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
  category TEXT NOT NULL,
  parent_id TEXT,
  config_json TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS dashboard_items (
  id TEXT PRIMARY KEY NOT NULL,
  element_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  overrides_json TEXT,
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
