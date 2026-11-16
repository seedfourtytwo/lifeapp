import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * `PRAGMA data_version` for this connection. SQLite changes it only when
 * another connection — another process included, such as the Android
 * home-screen widget — commits to the file; this connection's own writes leave
 * it alone. Equal readings mean nobody else wrote in between. The number itself
 * means nothing and differs between connections; only compare readings from
 * the same connection.
 */
export async function readDataVersion(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ data_version: number }>('PRAGMA data_version');
  return typeof row?.data_version === 'number' ? row.data_version : null;
}
