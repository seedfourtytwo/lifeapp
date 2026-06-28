import type { SQLiteDatabase } from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import { PROTOCOL_VERSION } from '../protocol';
import { DEFAULT_COUNTER_CONFIG } from '../protocol/kinds/counter';
import { SCHEMA_SQL } from './schema';

const CURRENT_SCHEMA_VERSION = 1;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1',
  );

  if (!row) {
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
    await seedDefaultData(db);
    return;
  }

  if (row.version < CURRENT_SCHEMA_VERSION) {
    // Future migrations go here, keyed by row.version.
    await db.runAsync('UPDATE schema_version SET version = ?', CURRENT_SCHEMA_VERSION);
  }
}

async function seedDefaultData(db: SQLiteDatabase): Promise<void> {
  const elementId = uuidv4();
  const dashboardId = uuidv4();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO elements (id, kind, name, category, parent_id, config_json, protocol_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    elementId,
    'counter',
    'Push-ups',
    'exercise',
    null,
    JSON.stringify(DEFAULT_COUNTER_CONFIG),
    PROTOCOL_VERSION,
    now,
  );

  await db.runAsync(
    `INSERT INTO dashboard_items (id, element_id, sort_order, overrides_json)
     VALUES (?, ?, ?, ?)`,
    dashboardId,
    elementId,
    0,
    null,
  );
}
