import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_NAME } from './schema';
import { runMigrations } from './migrations';

let dbInstance: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

function isRecoverableDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Invalid VFS state') ||
    message.includes('SharedArrayBuffer') ||
    message.includes('sqlite3_open')
  );
}

export function invalidateDatabaseConnection(): void {
  dbInstance = null;
  initPromise = null;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await runMigrations(db);
  return db;
}

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const maxAttempts = Platform.OS === 'web' ? 2 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const db = await openAndMigrate();
          dbInstance = db;
          return db;
        } catch (error) {
          if (attempt < maxAttempts - 1 && isRecoverableDbError(error)) {
            dbInstance = null;
            continue;
          }
          throw error;
        }
      }

      throw new Error('Failed to open database');
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

/** Reset singleton — for tests only. */
export function resetDatabaseForTests(): void {
  invalidateDatabaseConnection();
}
