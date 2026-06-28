import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_NAME } from './schema';
import { runMigrations } from './migrations';

let dbInstance: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await runMigrations(db);
      dbInstance = db;
      return db;
    })();
  }

  return initPromise;
}

/** Reset singleton — for tests only. */
export function resetDatabaseForTests(): void {
  dbInstance = null;
  initPromise = null;
}
