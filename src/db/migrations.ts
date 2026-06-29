import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../utils/id';
import * as dashboardRepo from './repositories/dashboardRepository';
import * as elementRepo from './repositories/elementRepository';
import { SCHEMA_SQL } from './schema';

const CURRENT_SCHEMA_VERSION = 3;

const MIGRATIONS: Record<number, (db: SQLiteDatabase) => Promise<void>> = {
  2: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },
  3: async (db) => {
    const [elements, dashboard] = await Promise.all([
      elementRepo.getAllElements(db),
      dashboardRepo.getDashboardItems(db),
    ]);
    const pinnedIds = new Set(dashboard.map((item) => item.elementId));
    let sortOrder = await dashboardRepo.getNextSortOrder(db);
    for (const element of elements) {
      if (pinnedIds.has(element.id)) continue;
      await dashboardRepo.insertDashboardItem(db, {
        id: newId(),
        elementId: element.id,
        sortOrder,
      });
      sortOrder += 1;
    }
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
