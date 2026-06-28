import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const CURRENT_SCHEMA_VERSION = 2;

const MIGRATIONS: Record<number, (db: SQLiteDatabase) => Promise<void>> = {
  2: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },
};

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1',
  );

  if (!row) {
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
    return;
  }

  let version = row.version;
  while (version < CURRENT_SCHEMA_VERSION) {
    const next = version + 1;
    const migrate = MIGRATIONS[next];
    if (migrate) {
      await migrate(db);
    }
    version = next;
    await db.runAsync('UPDATE schema_version SET version = ?', version);
  }
}
