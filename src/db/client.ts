import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_NAME } from './schema';
import { runMigrations } from './migrations';
import { takeSafetyCopy } from './safetyCopy';

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

/**
 * How long a statement waits for a lock another connection holds before
 * failing with SQLITE_BUSY. expo-sqlite never sets one, so SQLite's default of
 * 0 applies: any overlap — a safety copy's connection, a future reader in the
 * widget process — throws at once. Five seconds covers any write this app
 * makes; anything longer is a stuck connection, and failing is the right call.
 */
const BUSY_TIMEOUT_MS = 5000;

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // Per connection, and before the migrations' BEGIN IMMEDIATE.
  await db.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
  await runMigrations(db, { beforeUpgrade: () => takeSafetyCopy(db, 'migration') });
  return db;
}

export async function getDatabase(): Promise<SQLiteDatabase> {
  // Migrate only on open (openAndMigrate). Re-running DDL on every get races
  // concurrent startup loads (calendar/weather/settings) and crashes expo-sqlite.
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
