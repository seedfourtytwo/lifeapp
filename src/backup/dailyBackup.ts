import { exportProtocolBundle, serializeBundle } from '../db/export';
import { useAutoBackupStore } from '../store/autoBackupStore';
import { runAutoBackup } from './autoBackup';
import { autoBackupFileName, type BackupTarget } from './backupTarget';
import { phoneFolderTarget } from './phoneFolderTarget';

/**
 * Every target configured right now. The Montara server joins this list once
 * it can take a file; until then the phone folder is the only one.
 */
function configuredBackupTargets(): BackupTarget[] {
  const folder = useAutoBackupStore.getState().phoneFolderUri;
  return folder ? [phoneFolderTarget(folder)] : [];
}

/** Today's backup to every target that has none yet. Never rejects. */
export async function runDailyBackup(): Promise<void> {
  const store = useAutoBackupStore.getState();
  if (!store.loaded) {
    try {
      await store.load();
    } catch (error) {
      console.warn('Backup settings could not be read', error);
      return;
    }
  }
  await runAutoBackup({
    targets: configuredBackupTargets,
    now: () => new Date(),
    // The very file the manual export shares, under the automatic name.
    makeFile: async (at) => {
      const { bundle } = await exportProtocolBundle();
      return { name: autoBackupFileName(at), contents: serializeBundle(bundle) };
    },
    readStatuses: async () => useAutoBackupStore.getState().statuses,
    recordStatus: (name, status) => useAutoBackupStore.getState().recordStatus(name, status),
  });
}
