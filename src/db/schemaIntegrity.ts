import type { SQLiteDatabase } from 'expo-sqlite';

/** Repair drift when schema_version advanced without column migrations applying. */
export async function ensureElementsSchema(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(elements)');
  if (!columns.some((column) => column.name === 'archived_at')) {
    await db.execAsync('ALTER TABLE elements ADD COLUMN archived_at TEXT');
  }
}
