/**
 * Map rows, skipping (and logging) any that fail to parse, so one row an older
 * or broken build wrote cannot empty a whole list. Export counts the skips.
 */
export function readableRows<Row extends object, T>(
  table: string,
  rows: readonly Row[],
  toValue: (row: Row) => T,
): T[] {
  const values: T[] = [];
  for (const row of rows) {
    try {
      values.push(toValue(row));
    } catch (error) {
      const id = 'id' in row ? String(row.id) : '';
      console.warn(
        `Skipping unreadable ${table} row ${id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return values;
}
