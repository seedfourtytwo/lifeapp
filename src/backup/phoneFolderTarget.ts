import { StorageAccessFramework as SAF } from 'expo-file-system/legacy';
import { autoBackupsToPrune, isAutoBackupFileName, type BackupTarget } from './backupTarget';

/**
 * A folder on the phone that Chris picks once through Android's Storage
 * Access Framework (`expo-file-system/legacy`, SDK 54). The picker's grant is
 * made persistable (`takePersistableUriPermission`), so it holds across
 * restarts; files written here belong to the folder, not the app, and stay
 * after an uninstall. The grant itself does not survive one: after a
 * reinstall the folder is picked again.
 *
 * The file API only writes to `com.android.externalstorage` folders — the
 * phone's own storage — so other providers (cloud drives) are refused at pick.
 */

const PHONE_STORAGE = 'content://com.android.externalstorage.documents/tree/';

export const PHONE_FOLDER_TARGET = 'phoneFolder';

export function isPhoneStorageFolder(treeUri: string): boolean {
  return treeUri.startsWith(PHONE_STORAGE);
}

/** "primary:Documents/Life" → "Life": the folder's own name, as the picker showed it. */
export function folderDisplayName(treeUri: string): string {
  const documentId = decodeURIComponent(treeUri.slice(treeUri.lastIndexOf('/') + 1));
  const path = documentId.slice(documentId.indexOf(':') + 1);
  return path.slice(path.lastIndexOf('/') + 1) || documentId;
}

/** A child document URI ends in its encoded document id, whose last segment is the file name. */
function fileNameOf(documentUri: string): string {
  const documentId = decodeURIComponent(documentUri.slice(documentUri.lastIndexOf('/') + 1));
  return documentId.slice(documentId.lastIndexOf('/') + 1);
}

async function ownBackups(treeUri: string): Promise<{ name: string; uri: string }[]> {
  const children = await SAF.readDirectoryAsync(treeUri);
  return children
    .map((uri) => ({ name: fileNameOf(uri), uri }))
    .filter((child) => isAutoBackupFileName(child.name));
}

export function phoneFolderTarget(treeUri: string): BackupTarget {
  return {
    name: PHONE_FOLDER_TARGET,

    isAvailable: async () => {
      try {
        await SAF.readDirectoryAsync(treeUri);
        return true;
      } catch {
        return false;
      }
    },

    write: async (file) => {
      // The name already ends in .json, which matches the MIME type, so the
      // provider keeps it as given instead of appending another extension.
      const uri = await SAF.createFileAsync(treeUri, file.name, 'application/json');
      await SAF.writeAsStringAsync(uri, file.contents);
    },

    list: async () => (await ownBackups(treeUri)).map((backup) => backup.name),

    prune: async (keep) => {
      const backups = await ownBackups(treeUri);
      const doomed = new Set(autoBackupsToPrune(backups.map((backup) => backup.name), keep));
      for (const backup of backups) {
        if (doomed.has(backup.name)) await SAF.deleteAsync(backup.uri);
      }
    },
  };
}
