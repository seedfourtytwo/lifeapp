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
    initPromise = openAndMigrate().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await runMigrations(db);
  dbInstance = db;
  return db;
}

/** Reset singleton — for tests only. */
export function resetDatabaseForTests(): void {
  dbInstance = null;
  initPromise = null;
}
