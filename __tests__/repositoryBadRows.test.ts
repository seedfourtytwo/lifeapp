import * as calendarRepo from '../src/db/repositories/calendarRepository';
import * as foodRepo from '../src/db/repositories/foodRepository';
import { FoodItemSchema, PROTOCOL_VERSION } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * A row an older or broken build wrote must cost only itself. Events,
 * elements and todos already skip what they cannot read; calendar and the
 * food log threw, so one bad row emptied the whole calendar (and its
 * reminders) or the food day.
 */

const DATE = '2026-03-10';
const TIME = '2026-03-10T08:00:00.000Z';
const CALENDAR_ID = '550e8400-e29b-41d4-a716-446655440701';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440702';
const FOOD_ID = '550e8400-e29b-41d4-a716-446655440703';

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await calendarRepo.importCalendarData(testDb.db, {
    calendars: [{ id: CALENDAR_ID, name: 'Personal', color: '#3D7EA6', source: 'local' }],
    events: [
      {
        id: EVENT_ID,
        calendarId: CALENDAR_ID,
        uid: 'uid-good',
        title: 'Dentist',
        notes: null,
        eventType: 'general',
        allDay: true,
        startAt: DATE,
        endAt: DATE,
        timezone: 'UTC',
        rrule: null,
      },
    ],
    reminders: [
      {
        id: '550e8400-e29b-41d4-a716-446655440704',
        eventId: EVENT_ID,
        offsetMinutes: 30,
        enabled: true,
      },
    ],
    clearedOccurrences: [{ occurrenceKey: `${EVENT_ID}:${DATE}`, eventId: EVENT_ID, clearedAt: TIME }],
  });
  await foodRepo.insertFoodItem(
    testDb.db,
    FoodItemSchema.parse({
      id: FOOD_ID,
      name: 'Carrot',
      group: 'vegetable',
      createdAt: TIME,
      protocolVersion: PROTOCOL_VERSION,
    }),
  );
  await foodRepo.insertFoodLogEntry(testDb.db, {
    id: '550e8400-e29b-41d4-a716-446655440705',
    foodId: FOOD_ID,
    date: DATE,
    loggedAt: TIME,
    protocolVersion: PROTOCOL_VERSION,
  });
});

afterEach(() => {
  testDb.raw.close();
  jest.restoreAllMocks();
});

function run(sql: string, ...params: (string | number | null)[]): void {
  testDb.raw.prepare(sql).run(...params);
}

it('skips an unreadable calendar and keeps the rest', async () => {
  run('INSERT INTO calendars (id, name, color, source) VALUES (?, ?, ?, ?)', 'bad', 'Old', '#000000', 'local');

  expect((await calendarRepo.getAllCalendars(testDb.db)).map((c) => c.id)).toEqual([CALENDAR_ID]);
});

it('skips an unreadable calendar event and keeps the rest', async () => {
  run(
    `INSERT INTO calendar_events (id, calendar_id, uid, title, notes, event_type, all_day, start_at, end_at, timezone, rrule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'bad', CALENDAR_ID, 'uid-bad', 'Broken', null, 'general', 1, DATE, DATE, 'UTC', null,
  );

  expect((await calendarRepo.getAllEvents(testDb.db)).map((e) => e.id)).toEqual([EVENT_ID]);
});

it('skips an unreadable reminder and keeps the rest', async () => {
  run(
    'INSERT INTO calendar_reminders (id, event_id, offset_minutes, enabled) VALUES (?, ?, ?, ?)',
    'bad', EVENT_ID, 15, 1,
  );

  expect(await calendarRepo.getAllReminders(testDb.db)).toHaveLength(1);
});

it('skips an unreadable cleared occurrence and keeps the rest', async () => {
  run(
    'INSERT INTO calendar_occurrence_clears (occurrence_key, event_id, cleared_at) VALUES (?, ?, ?)',
    `${EVENT_ID}:2026-03-11`, EVENT_ID, 'never',
  );

  expect(await calendarRepo.getAllOccurrenceClears(testDb.db)).toHaveLength(1);
});

it('skips an unreadable food log row and keeps the rest', async () => {
  run(
    'INSERT INTO food_log (id, food_id, date, logged_at, protocol_version) VALUES (?, ?, ?, ?, ?)',
    'bad', FOOD_ID, '2026-03-11', 'never', PROTOCOL_VERSION,
  );

  expect(await foodRepo.getAllFoodLog(testDb.db)).toHaveLength(1);
  expect(await foodRepo.getFoodLogForDates(testDb.db, [DATE, '2026-03-11'])).toHaveLength(1);
});
