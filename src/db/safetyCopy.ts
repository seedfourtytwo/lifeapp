import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * A raw copy of the whole database, taken just before something that could
 * lose it: a schema upgrade, an import, a clear. It lives in the app's own
 * storage (so it goes with an uninstall — the backup folder is for that) and
 * only the last few are kept.
 *
 * `backupDatabaseAsync` is SQLite's online backup API run on the live
 * connection (expo-sqlite 16: `sqlite3_backup_init` / `step(-1)` / `finish`).
 * It reads through that connection's pager, so pages still sitting in the WAL
 * are included, and it refuses with SQLITE_BUSY while that connection holds a
 * write transaction — callers take it outside one.
 */

export type SafetyCopyReason = 'migration' | 'import' | 'clear';

export const SAFETY_COPIES_KEPT = 5;

const COPY_NAME = /^(\d{8}T\d{9}Z-(?:migration|import|clear)\.db)(?:-wal|-shm|-journal)?$/;

function copiesDirectory(): string {
  return `${SQLite.defaultDatabaseDirectory}/safety-copies`;
}

function fileUri(path: string): string {
  return `file://${path}`;
}

/** UTC and fixed-width, so a plain sort is oldest first across clock changes. */
export function safetyCopyFileName(reason: SafetyCopyReason, at: Date): string {
  const stamp = at.toISOString().replace(/[-:.]/g, '');
  return `${stamp}-${reason}.db`;
}

/** Every file belonging to a copy older than the newest `keep`. Other files are left alone. */
export function safetyCopiesToPrune(names: readonly string[], keep: number): string[] {
  const copies = new Set<string>();
  for (const name of names) {
    const match = COPY_NAME.exec(name);
    if (match?.[1]) copies.add(match[1]);
  }
  const doomed = new Set([...copies].sort().slice(0, Math.max(0, copies.size - keep)));
  return names.filter((name) => {
    const base = COPY_NAME.exec(name)?.[1];
    return base != null && doomed.has(base);
  });
}

/**
 * Throws if the copy could not be made, and the caller must then not go on:
 * the point of the copy is that the risky step never runs without one.
 */
export async function takeSafetyCopy(
  db: SQLiteDatabase,
  reason: SafetyCopyReason,
  at: Date = new Date(),
): Promise<void> {
  const directory = copiesDirectory();
  const name = safetyCopyFileName(reason, at);
  const copy = await SQLite.openDatabaseAsync(name, undefined, directory);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: db, destDatabase: copy });
  } catch (error) {
    await copy.closeAsync();
    await FileSystem.deleteAsync(fileUri(`${directory}/${name}`), { idempotent: true });
    throw error;
  }
  await copy.closeAsync();

  const listing = await FileSystem.readDirectoryAsync(fileUri(directory));
  for (const stale of safetyCopiesToPrune(listing, SAFETY_COPIES_KEPT)) {
    await FileSystem.deleteAsync(fileUri(`${directory}/${stale}`), { idempotent: true });
  }
}
