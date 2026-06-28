import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const CURRENT_SCHEMA_VERSION = 1;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1',
  );

  if (!row) {
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
    return;
  }

  if (row.version < CURRENT_SCHEMA_VERSION) {
    // Future migrations go here, keyed by row.version.
    await db.runAsync('UPDATE schema_version SET version = ?', CURRENT_SCHEMA_VERSION);
  }
}
