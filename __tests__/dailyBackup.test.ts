/* eslint-disable import/first -- jest mocks must load before module imports */
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/files/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(async () => undefined),
  StorageAccessFramework: {
    readDirectoryAsync: jest.fn(async () => []),
    createFileAsync: jest.fn(async (_tree: string, name: string) => `content://doc/${name}`),
    writeAsStringAsync: jest.fn(async () => undefined),
    deleteAsync: jest.fn(async () => undefined),
  },
}));

import { StorageAccessFramework as SAF } from 'expo-file-system/legacy';
import { getDatabase } from '../src/db/client';
import { exportProtocolBundle, serializeBundle } from '../src/db/export';
import * as elementRepo from '../src/db/repositories/elementRepository';
import { runDailyBackup } from '../src/backup/dailyBackup';
import { HabitConfigSchema, PROTOCOL_VERSION } from '../src/protocol';
import { useAutoBackupStore } from '../src/store/autoBackupStore';
import { createMigratedTestDb } from './support/sqliteTestDb';

/** The app's daily backup: the manual export's file, into the folder Chris picked. */

const FOLDER = 'content://com.android.externalstorage.documents/tree/primary%3ALife';

beforeEach(async () => {
  jest.clearAllMocks();
  const testDb = await createMigratedTestDb();
  (getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await elementRepo.insertElement(testDb.db, {
    id: '550e8400-e29b-41d4-a716-446655440a01',
    kind: 'habit',
    name: 'Sprouts',
    config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  });
  useAutoBackupStore.setState({ phoneFolderUri: null, statuses: {}, loaded: true });
});

it('writes nothing until a folder is chosen', async () => {
  await runDailyBackup();
  expect(SAF.createFileAsync).not.toHaveBeenCalled();
});

it('writes the same file the manual export makes', async () => {
  await useAutoBackupStore.getState().setPhoneFolder(FOLDER);

  await runDailyBackup();

  const [, written] = (SAF.writeAsStringAsync as jest.Mock).mock.calls[0] as [string, string];
  const { bundle } = await exportProtocolBundle();
  const manual = JSON.parse(serializeBundle(bundle)) as Record<string, unknown>;
  expect({ ...(JSON.parse(written) as Record<string, unknown>), exportedAt: '' }).toEqual({
    ...manual,
    exportedAt: '',
  });
  expect(useAutoBackupStore.getState().statuses.phoneFolder?.lastSuccessAt).toEqual(expect.any(String));
});
