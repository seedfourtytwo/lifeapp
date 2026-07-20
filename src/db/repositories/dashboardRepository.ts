import type { SQLiteDatabase } from 'expo-sqlite';
import type { DashboardItem } from '../../protocol';

interface DashboardRow {
  id: string;
  element_id: string;
  sort_order: number;
}

function rowToDashboardItem(row: DashboardRow): DashboardItem {
  return {
    id: row.id,
    elementId: row.element_id,
    sortOrder: row.sort_order,
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
    `INSERT INTO dashboard_items (id, element_id, sort_order)
     VALUES (?, ?, ?)`,
    item.id,
    item.elementId,
    item.sortOrder,
  );
}

export async function deleteDashboardItem(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM dashboard_items WHERE id = ?', id);
}

export async function deleteDashboardItemForElement(
  db: SQLiteDatabase,
  elementId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM dashboard_items WHERE element_id = ?', elementId);
}

/** Idempotent pin insert — safe under heal races with concurrent create. */
export async function insertDashboardItemIfAbsent(
  db: SQLiteDatabase,
  item: DashboardItem,
): Promise<boolean> {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO dashboard_items (id, element_id, sort_order)
     VALUES (?, ?, ?)`,
    item.id,
    item.elementId,
    item.sortOrder,
  );
  return (result.changes ?? 0) > 0;
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

/** Persist a new absolute sort_order for each dashboard item id. */
export async function setDashboardSortOrders(
  db: SQLiteDatabase,
  orders: { id: string; sortOrder: number }[],
): Promise<void> {
  if (orders.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const item of orders) {
      await db.runAsync(
        'UPDATE dashboard_items SET sort_order = ? WHERE id = ?',
        item.sortOrder,
        item.id,
      );
    }
  });
}
