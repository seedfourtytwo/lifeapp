/**
 * How an export ended. Native always goes through the share sheet ('shared');
 * web downloads straight to disk ('saved'). Shared by both platform variants
 * so the alert mapping below stays exhaustive. `skippedRows` counts rows the
 * database held but could not read, which are therefore not in the file.
 */
export type ExportBackupResult = {
  destination: 'saved' | 'shared';
  skippedRows: number;
};

/**
 * i18n keys for the post-export confirmation. Every outcome confirms — an
 * export that says nothing is indistinguishable from one that failed — and
 * one that left rows out says so (`skippedRowsKey`, interpolated with the count).
 */
export function exportBackupAlertKeys(result: ExportBackupResult): {
  titleKey: string;
  bodyKey: string;
  skippedRowsKey: string | null;
} {
  const skippedRowsKey = result.skippedRows > 0 ? 'settings:data.backupSkippedRows' : null;
  if (result.destination === 'saved') {
    return {
      titleKey: 'settings:data.backupSavedTitle',
      bodyKey: 'settings:data.backupSavedBody',
      skippedRowsKey,
    };
  }
  return {
    titleKey: 'settings:data.backupSharedTitle',
    bodyKey: 'settings:data.backupSharedBody',
    skippedRowsKey,
  };
}
