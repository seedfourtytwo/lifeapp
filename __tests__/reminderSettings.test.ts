/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads a fresh store after resetModules() */
/**
 * The reminder settings, through the real settings store and backup code on a
 * real SQLite. Only the connection is swapped for an in-memory database.
 */
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

type SettingsStore = typeof import('../src/store/settingsStore');
type Backup = typeof import('../src/db/appSettingsBackup');

let testDb: TestDb;
let settings: SettingsStore;
let backup: Backup;

beforeEach(async () => {
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  settings = require('../src/store/settingsStore');
  backup = require('../src/db/appSettingsBackup');
});

async function reload(): Promise<SettingsStore['useSettingsStore']> {
  jest.resetModules();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  const fresh: SettingsStore = require('../src/store/settingsStore');
  await fresh.useSettingsStore.getState().load();
  return fresh.useSettingsStore;
}

it('has habit reminders on until the user turns them off', async () => {
  await settings.useSettingsStore.getState().load();

  expect(settings.useSettingsStore.getState().trackerRemindersEnabled).toBe(true);
});

it('remembers habit reminders switched off across a restart', async () => {
  await settings.useSettingsStore.getState().load();
  await settings.useSettingsStore.getState().setTrackerRemindersEnabled(false);

  const store = await reload();

  expect(store.getState().trackerRemindersEnabled).toBe(false);
});

it('keeps the habit reminder switch apart from the evening check-in', async () => {
  await settings.useSettingsStore.getState().load();
  await settings.useSettingsStore.getState().setTrackerRemindersEnabled(false);

  const store = await reload();

  expect(store.getState().eveningCheckInEnabled).toBe(true);
});

it('carries the habit reminder switch through a backup', async () => {
  await settings.useSettingsStore.getState().load();
  await settings.useSettingsStore.getState().setTrackerRemindersEnabled(false);
  const exported = await backup.readAppSettings(testDb.db);
  const { AppSettingsSchema } = require('../src/protocol/appSettings');
  const parsed = AppSettingsSchema.parse(JSON.parse(JSON.stringify(exported)));

  const target = await createMigratedTestDb();
  await backup.writeAppSettings(target.db, parsed);

  expect((await backup.readAppSettings(target.db)).trackerRemindersEnabled).toBe(false);
});
