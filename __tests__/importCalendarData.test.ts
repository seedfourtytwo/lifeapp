import type { SQLiteDatabase } from 'expo-sqlite';
import { importCalendarData } from '../src/db/repositories/calendarRepository';

describe('importCalendarData', () => {
  it('does not open a nested SQLite transaction', async () => {
    const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => fn());
    const runAsync = jest.fn(async () => undefined);
    const db = { withTransactionAsync, runAsync } as unknown as SQLiteDatabase;

    await importCalendarData(db, {
      calendars: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Personal',
          color: '#3D7EA6',
          source: 'local',
        },
      ],
      events: [],
      reminders: [],
      clearedOccurrences: [],
    });

    expect(withTransactionAsync).not.toHaveBeenCalled();
    expect(runAsync).toHaveBeenCalled();
  });
});
