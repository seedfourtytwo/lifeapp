import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './client';

async function clearProtocolTables(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM events');
  await db.runAsync('DELETE FROM dashboard_items');
  await db.runAsync('DELETE FROM elements');
}

export async function clearAppSettings(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM app_settings');
}

/** Wipe all local app data — elements, events, dashboard pins, and preferences. */
export async function clearAllAppData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await clearProtocolTables(db);
    await clearAppSettings(db);
  });
}

/** Replace protocol tables and preferences before importing a backup bundle. */
export async function clearDataForImport(db: SQLiteDatabase): Promise<void> {
  await clearProtocolTables(db);
  await clearAppSettings(db);
}
