/**
 * How an export ended. Native always goes through the share sheet ('shared');
 * web downloads straight to disk ('saved'). Shared by both platform variants
 * so the alert mapping below stays exhaustive.
 */
export type ExportBackupResult = 'saved' | 'shared';

/**
 * i18n keys for the post-export confirmation. Every outcome confirms — an
 * export that says nothing is indistinguishable from one that failed.
 */
export function exportBackupAlertKeys(result: ExportBackupResult): {
  titleKey: string;
  bodyKey: string;
} {
  if (result === 'saved') {
    return {
      titleKey: 'settings:data.backupSavedTitle',
      bodyKey: 'settings:data.backupSavedBody',
    };
  }
  return {
    titleKey: 'settings:data.backupSharedTitle',
    bodyKey: 'settings:data.backupSharedBody',
  };
}
