/* eslint-disable import/first -- jest mocks must load before module imports */
const mockFiles = new Map<string, string>();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/mockFiles/',
  readAsStringAsync: jest.fn(async (uri: string) => {
    const contents = mockFiles.get(uri);
    if (contents === undefined) throw new Error(`no file ${uri}`);
    return contents;
  }),
  writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
    mockFiles.set(uri, contents);
  }),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) })),
}));

import { useAutoBackupStore } from '../src/store/autoBackupStore';

/**
 * Where the backup folder and each target's last result are kept: a small
 * file of the app's own, outside SQLite, so an import or a clear of
 * preferences does not quietly switch the daily backup off.
 */

const STATE_FILE = 'file:///data/mockFiles/auto-backup.json';

beforeEach(() => {
  mockFiles.clear();
  useAutoBackupStore.setState({ phoneFolderUri: null, statuses: {}, loaded: false });
});

it('starts with no folder and nothing recorded', async () => {
  await useAutoBackupStore.getState().load();
  expect(useAutoBackupStore.getState()).toMatchObject({ phoneFolderUri: null, statuses: {}, loaded: true });
});

it('keeps the folder and each status across a restart', async () => {
  await useAutoBackupStore.getState().load();
  await useAutoBackupStore.getState().setPhoneFolder('content://com.android.externalstorage.documents/tree/primary%3ALife');
  await useAutoBackupStore.getState().recordStatus('phoneFolder', {
    lastSuccessAt: '2026-11-11T07:00:00.000Z',
    lastError: null,
  });

  useAutoBackupStore.setState({ phoneFolderUri: null, statuses: {}, loaded: false });
  await useAutoBackupStore.getState().load();

  expect(useAutoBackupStore.getState()).toMatchObject({
    phoneFolderUri: 'content://com.android.externalstorage.documents/tree/primary%3ALife',
    statuses: { phoneFolder: { lastSuccessAt: '2026-11-11T07:00:00.000Z', lastError: null } },
  });
});

it('starts over rather than failing on a file it cannot read', async () => {
  mockFiles.set(STATE_FILE, '{not json');
  await useAutoBackupStore.getState().load();
  expect(useAutoBackupStore.getState()).toMatchObject({ phoneFolderUri: null, statuses: {}, loaded: true });
});
