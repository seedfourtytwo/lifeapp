import type { SQLiteDatabase } from 'expo-sqlite';

/** Tables whose rows travel in a backup; a closed list so no name is ever built from input. */
export type BackedUpTable =
  | 'elements'
  | 'dashboard_items'
  | 'events'
  | 'day_notes'
  | 'journal_notebooks'
  | 'daily_journals'
  | 'calendars'
  | 'calendar_events'
  | 'calendar_reminders'
  | 'calendar_occurrence_clears'
  | 'food_items'
  | 'food_log'
  | 'todos';

export async function countRows(db: SQLiteDatabase, table: BackedUpTable): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}
