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
  created_at TEXT NOT NULL
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
`;
