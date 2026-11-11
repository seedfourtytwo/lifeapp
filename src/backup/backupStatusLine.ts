import { TARGET_UNAVAILABLE, type TargetStatus } from './autoBackup';

/** What the backup-folder row says, as an i18n key in the settings namespace and its values. */
export type BackupStatusLine =
  | { key: 'data.autoBackupNotSet' }
  | { key: 'data.autoBackupWaiting' }
  | { key: 'data.autoBackupLast'; when: Date }
  | { key: 'data.autoBackupFolderGone'; when: Date }
  | { key: 'data.autoBackupFailed'; when: Date; reason: string };

/** The newer of the last backup and the last error wins. */
export function backupStatusLine(
  folderUri: string | null,
  status: TargetStatus | undefined,
): BackupStatusLine {
  if (!folderUri) return { key: 'data.autoBackupNotSet' };
  const success = status?.lastSuccessAt ? new Date(status.lastSuccessAt) : null;
  const error = status?.lastError;
  if (error && (!success || new Date(error.at) > success)) {
    const when = new Date(error.at);
    return error.message === TARGET_UNAVAILABLE
      ? { key: 'data.autoBackupFolderGone', when }
      : { key: 'data.autoBackupFailed', when, reason: error.message };
  }
  if (success) return { key: 'data.autoBackupLast', when: success };
  return { key: 'data.autoBackupWaiting' };
}
