import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

/** One round-trip for many keys — missing keys map to `null`. */
export async function getSettings(
  db: SQLiteDatabase,
  keys: readonly string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const key of keys) {
    result.set(key, null);
  }
  if (keys.length === 0) return result;

  const placeholders = keys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`,
    ...keys,
  );
  for (const row of rows) {
    result.set(row.key, row.value);
  }
  return result;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function deleteSetting(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', key);
}
