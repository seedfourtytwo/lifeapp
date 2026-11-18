import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Run `task` inside `BEGIN IMMEDIATE … COMMIT` on this connection.
 *
 * Use it for read-then-write operations that another connection (the Android
 * home-screen widget) may race. IMMEDIATE takes SQLite's write lock before the
 * first read, so what `task` reads cannot change before it writes, and a
 * contending writer is waited out by `PRAGMA busy_timeout` (set in `client.ts`).
 * A plain `BEGIN` — what `withTransactionAsync` issues — only asks for the write
 * lock at the first write; if another connection committed in between, WAL
 * fails that upgrade with SQLITE_BUSY_SNAPSHOT, which busy_timeout does not retry.
 *
 * `withExclusiveTransactionAsync` is not a substitute: it opens a fresh
 * connection per call (no busy_timeout on it, extra open cost per tap), still
 * issues a plain `BEGIN`, returns nothing, and is unsupported on web.
 *
 * Callers hold `withDbWriteLock` so no other app write interleaves on this
 * shared connection while the transaction is open.
 */
export async function withImmediateTransaction<T>(
  db: SQLiteDatabase,
  task: () => Promise<T>,
): Promise<T> {
  await db.execAsync('BEGIN IMMEDIATE');
  let result: T;
  try {
    result = await task();
    await db.execAsync('COMMIT');
  } catch (error) {
    try {
      await db.execAsync('ROLLBACK');
    } catch {
      // No transaction left to roll back (e.g. SQLite already rolled it back).
    }
    throw error;
  }
  return result;
}
