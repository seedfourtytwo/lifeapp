/* eslint-disable import/first -- jest mocks must load before module imports */
jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(async () => undefined),
    deleteAsync: jest.fn(async () => undefined),
  },
}));

import { StorageAccessFramework as SAF } from 'expo-file-system/legacy';
import { autoBackupFileName } from '../src/backup/backupTarget';
import {
  folderDisplayName,
  isPhoneStorageFolder,
  phoneFolderTarget,
} from '../src/backup/phoneFolderTarget';

const TREE = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FLife';

function documentUri(name: string): string {
  return `${TREE}/document/${encodeURIComponent(`primary:Documents/Life/${name}`)}`;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('writes the backup as a new JSON file in the chosen folder', async () => {
  const name = autoBackupFileName(new Date(2026, 10, 11, 8));
  (SAF.createFileAsync as jest.Mock).mockResolvedValue(documentUri(name));

  await phoneFolderTarget(TREE).write({ name, contents: '{"a":1}' });

  expect(SAF.createFileAsync).toHaveBeenCalledWith(TREE, name, 'application/json');
  expect(SAF.writeAsStringAsync).toHaveBeenCalledWith(documentUri(name), '{"a":1}');
});

it('lists only its own automatic backups, by file name', async () => {
  const auto = autoBackupFileName(new Date(2026, 10, 11, 8));
  (SAF.readDirectoryAsync as jest.Mock).mockResolvedValue([
    documentUri(auto),
    documentUri('life-dashboard-backup-2026-11-01-090000.json'),
    documentUri('notes.txt'),
  ]);

  expect(await phoneFolderTarget(TREE).list()).toEqual([auto]);
});

it('prunes the oldest automatic backups and nothing else', async () => {
  const days = Array.from({ length: 3 }, (_, i) => autoBackupFileName(new Date(2026, 10, i + 1, 8)));
  (SAF.readDirectoryAsync as jest.Mock).mockResolvedValue([
    ...days.map(documentUri),
    documentUri('life-dashboard-backup-2020-01-01-090000.json'),
  ]);

  await phoneFolderTarget(TREE).prune(2);

  expect(SAF.deleteAsync).toHaveBeenCalledTimes(1);
  expect(SAF.deleteAsync).toHaveBeenCalledWith(documentUri(days[0]!));
});

it('is unavailable once the folder can no longer be read', async () => {
  (SAF.readDirectoryAsync as jest.Mock).mockRejectedValueOnce(new Error("Location isn't readable."));
  expect(await phoneFolderTarget(TREE).isAvailable()).toBe(false);
  (SAF.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([]);
  expect(await phoneFolderTarget(TREE).isAvailable()).toBe(true);
});

it('accepts only folders on the phone itself, which is all the file API can write', () => {
  expect(isPhoneStorageFolder(TREE)).toBe(true);
  expect(isPhoneStorageFolder('content://me.proton.android.drive.documents/tree/root')).toBe(false);
});

it('names the folder the way the picker showed it', () => {
  expect(folderDisplayName(TREE)).toBe('Life');
  expect(folderDisplayName('content://com.android.externalstorage.documents/tree/primary%3ABackups')).toBe('Backups');
});
