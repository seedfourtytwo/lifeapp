import type { SQLiteDatabase } from 'expo-sqlite';
import type { DashboardItem } from '../../protocol';

interface DashboardRow {
  id: string;
  element_id: string;
  sort_order: number;
  overrides_json: string | null;
}

function rowToDashboardItem(row: DashboardRow): DashboardItem {
  return {
    id: row.id,
    elementId: row.element_id,
    sortOrder: row.sort_order,
    overrides: row.overrides_json
      ? (JSON.parse(row.overrides_json) as Record<string, unknown>)
      : undefined,
  };
}

export async function getDashboardItems(db: SQLiteDatabase): Promise<DashboardItem[]> {
  const rows = await db.getAllAsync<DashboardRow>(
    'SELECT * FROM dashboard_items ORDER BY sort_order ASC',
  );
  return rows.map(rowToDashboardItem);
}

export async function insertDashboardItem(
  db: SQLiteDatabase,
  item: DashboardItem,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO dashboard_items (id, element_id, sort_order, overrides_json)
     VALUES (?, ?, ?, ?)`,
    item.id,
    item.elementId,
    item.sortOrder,
    item.overrides ? JSON.stringify(item.overrides) : null,
  );
}

export async function deleteDashboardItem(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM dashboard_items WHERE id = ?', id);
}

export async function isElementOnDashboard(
  db: SQLiteDatabase,
  elementId: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM dashboard_items WHERE element_id = ?',
    elementId,
  );
  return (row?.count ?? 0) > 0;
}

export async function getNextSortOrder(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM dashboard_items',
  );
  return (row?.maxOrder ?? -1) + 1;
}
