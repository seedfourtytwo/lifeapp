/* eslint-disable import/first -- jest mocks must load before module imports */
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../src/db/client';
import { useCalendarStore } from '../src/store/calendarStore';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * `isLoaded` is what lets the reminder sync run, and the sync cancels every
 * calendar reminder before scheduling what the store holds. A load that
 * failed must therefore not look like a load that found nothing.
 */

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  (getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await useCalendarStore.getState().reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  testDb.raw.close();
  jest.restoreAllMocks();
});

it('marks the calendar loaded after a load that worked', async () => {
  await useCalendarStore.getState().load();

  expect(useCalendarStore.getState().isLoaded).toBe(true);
});

it('stays not loaded when the load fails, so reminders are not cancelled', async () => {
  await useCalendarStore.getState().load();
  (getDatabase as jest.Mock).mockRejectedValue(new Error('disk I/O error'));

  await useCalendarStore.getState().load();

  expect(useCalendarStore.getState().isLoaded).toBe(false);
});
