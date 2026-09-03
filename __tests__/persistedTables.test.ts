/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrations';
import { ensureSchemaIntegrity } from '../src/db/schemaIntegrity';
import { clearAppData, clearDataForImport } from '../src/db/resetAppData';
import { exportProtocolBundle, importProtocolBundle } from '../src/db/export';
import type { ClearAppDataOptions } from '../src/db/clearDataPlan';
import * as calendarRepo from '../src/db/repositories/calendarRepository';
import * as dailyJournalRepo from '../src/db/repositories/dailyJournalRepository';
import * as dashboardRepo from '../src/db/repositories/dashboardRepository';
import * as dayNoteRepo from '../src/db/repositories/dayNoteRepository';
import * as elementRepo from '../src/db/repositories/elementRepository';
import * as eventRepo from '../src/db/repositories/eventRepository';
import * as foodRepo from '../src/db/repositories/foodRepository';
import * as noteShareRepo from '../src/db/repositories/noteShareStateRepository';
import * as settingsRepo from '../src/db/repositories/settingsRepository';
import * as todoRepo from '../src/db/repositories/todoRepository';
import * as weatherRepo from '../src/db/repositories/weatherRepository';
import { WEATHER_FORECAST_CACHE_KEY } from '../src/weather/forecastCache';
import { FoodItemSchema, HabitConfigSchema, PROTOCOL_VERSION } from '../src/protocol';

/**
 * Characterisation tests for the *current* shape of the database: what a fresh
 * install creates, that the repair pass is a no-op the second time, what each
 * clear shape removes, and which tables survive a backup round-trip.
 *
 * Deliberately table-driven and exhaustive: every persisted table appears in
 * every matrix below, and `TABLES` is checked against what a fresh install
 * actually creates — so adding a table without deciding its clear and backup
 * behaviour fails here instead of silently doing nothing.
 */

type Bind = null | number | string;

function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  } as unknown as SQLiteDatabase;
}

const TABLES = [
  'schema_version',
  'elements',
  'dashboard_items',
  'events',
  'day_notes',
  'journal_notebooks',
  'daily_journals',
  'food_items',
  'food_log',
  'todos',
  'note_share_state',
  'app_settings',
  'weather_daily',
  'calendars',
  'calendar_events',
  'calendar_reminders',
  'calendar_occurrence_clears',
] as const;

type TableName = (typeof TABLES)[number];
type RowCounts = Record<TableName, number>;

function tableNames(raw: DatabaseSync): string[] {
  return (
    raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[]
  ).map((row) => row.name);
}

/** Every table, index and trigger, as SQLite itself reports them. */
function schemaSnapshot(raw: DatabaseSync): string[] {
  return (
    raw
      .prepare(
        "SELECT type, name, COALESCE(sql, '') AS sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      )
      .all() as { type: string; name: string; sql: string }[]
  ).map((row) => `${row.type} ${row.name} ${row.sql.replace(/\s+/g, ' ').trim()}`);
}

function rowCounts(raw: DatabaseSync): RowCounts {
  const counts = {} as RowCounts;
  for (const table of TABLES) {
    const row = raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    counts[table] = Number(row.n);
  }
  return counts;
}

const ELEMENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const DASHBOARD_ID = '550e8400-e29b-41d4-a716-446655440002';
const FOOD_ID = '550e8400-e29b-41d4-a716-446655440003';
const CALENDAR_ID = '550e8400-e29b-41d4-a716-446655440004';
const CALENDAR_EVENT_ID = '550e8400-e29b-41d4-a716-446655440005';
const CALENDAR_REMINDER_ID = '550e8400-e29b-41d4-a716-446655440006';

/** `id(n)` keeps the fixtures readable while staying valid v4 UUIDs. */
function id(n: number): string {
  return `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`;
}

/** Old enough to fall before the period cut-off used by the dated clear. */
const OLD_DATE = '2020-01-01';
const OLD_TIME = '2020-01-01T10:00:00.000Z';
/** Comfortably after the cut-off, so the dated clear must keep it. */
const NEW_DATE = '2030-01-01';
const NEW_TIME = '2030-01-01T10:00:00.000Z';

const CUTOFF = '2021-01-01';

/**
 * One row in every table — two in the dated ones, straddling the cut-off, so a
 * period-limited clear is distinguishable from an all-time one.
 * journal_notebooks is left to the default notebook the repair pass seeds.
 */
async function seedEveryTable(db: SQLiteDatabase, notebookId: string): Promise<void> {
  await elementRepo.insertElement(db, {
    id: ELEMENT_ID,
    kind: 'habit',
    name: 'Meditate',
    config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: OLD_TIME,
    archivedAt: null,
  });
  await dashboardRepo.insertDashboardItem(db, {
    id: DASHBOARD_ID,
    elementId: ELEMENT_ID,
    sortOrder: 0,
  });

  for (const [index, [date, time]] of [
    [OLD_DATE, OLD_TIME],
    [NEW_DATE, NEW_TIME],
  ].entries()) {
    await eventRepo.insertEvent(db, {
      id: id(10 + index),
      elementId: ELEMENT_ID,
      timestamp: time as string,
      date: date as string,
      value: 1,
      protocolVersion: PROTOCOL_VERSION,
    });
    await dayNoteRepo.insertNote(db, {
      id: id(20 + index),
      elementId: ELEMENT_ID,
      date: date as string,
      body: `note ${date}`,
      updatedAt: time as string,
      protocolVersion: PROTOCOL_VERSION,
    });
    await dailyJournalRepo.insertJournal(db, {
      id: id(30 + index),
      notebookId,
      date: date as string,
      body: `journal ${date}`,
      sortOrder: 0,
      createdAt: time as string,
      updatedAt: time as string,
      protocolVersion: PROTOCOL_VERSION,
    });
    await noteShareRepo.upsertShareState(
      db,
      { kind: 'tracker', elementId: ELEMENT_ID, entryId: '' },
      date as string,
      `fp-${date}`,
    );
  }

  await foodRepo.insertFoodItem(
    db,
    FoodItemSchema.parse({
      id: FOOD_ID,
      name: 'Carrot',
      group: 'vegetable',
      createdAt: OLD_TIME,
      protocolVersion: PROTOCOL_VERSION,
    }),
  );
  for (const [index, [date, time]] of [
    [OLD_DATE, OLD_TIME],
    [NEW_DATE, NEW_TIME],
  ].entries()) {
    await foodRepo.insertFoodLogEntry(db, {
      id: id(40 + index),
      foodId: FOOD_ID,
      date: date as string,
      loggedAt: time as string,
      protocolVersion: PROTOCOL_VERSION,
    });
  }

  await todoRepo.insertTodo(db, {
    id: id(50),
    title: 'Still open',
    note: null,
    dueDate: null,
    sortOrder: 0,
    createdAt: OLD_TIME,
    completedAt: null,
    protocolVersion: PROTOCOL_VERSION,
  });
  await todoRepo.insertTodo(db, {
    id: id(51),
    title: 'Done long ago',
    note: null,
    dueDate: null,
    sortOrder: 1,
    createdAt: OLD_TIME,
    completedAt: OLD_TIME,
    protocolVersion: PROTOCOL_VERSION,
  });
  await todoRepo.insertTodo(db, {
    id: id(52),
    title: 'Done recently',
    note: null,
    dueDate: null,
    sortOrder: 2,
    createdAt: OLD_TIME,
    completedAt: NEW_TIME,
    protocolVersion: PROTOCOL_VERSION,
  });

  await settingsRepo.setSetting(db, 'theme_mode', 'dark');
  await settingsRepo.setSetting(db, WEATHER_FORECAST_CACHE_KEY, '{}');

  await weatherRepo.upsertWeatherDaily(db, {
    date: OLD_DATE,
    tempC: 10,
    tempMinC: 5,
    tempMaxC: 15,
    weatherCode: 0,
    condition: 'sunny',
    precipProbabilityPct: 10,
    lat: 1,
    lon: 2,
    fetchedAt: OLD_TIME,
  });

  await calendarRepo.importCalendarData(db, {
    calendars: [{ id: CALENDAR_ID, name: 'Personal', color: '#3D7EA6', source: 'local' }],
    events: [
      {
        id: CALENDAR_EVENT_ID,
        calendarId: CALENDAR_ID,
        uid: 'uid-1',
        title: 'Dentist',
        notes: null,
        eventType: 'general',
        allDay: true,
        startAt: OLD_DATE,
        endAt: OLD_DATE,
        timezone: 'UTC',
        rrule: null,
      },
    ],
    reminders: [
      {
        id: CALENDAR_REMINDER_ID,
        eventId: CALENDAR_EVENT_ID,
        offsetMinutes: 30,
        enabled: true,
      },
    ],
    clearedOccurrences: [
      {
        occurrenceKey: `${CALENDAR_EVENT_ID}:${OLD_DATE}`,
        eventId: CALENDAR_EVENT_ID,
        clearedAt: OLD_TIME,
      },
    ],
  });
}

/** Row counts immediately after `seedEveryTable`. */
const SEEDED: RowCounts = {
  schema_version: 1,
  elements: 1,
  dashboard_items: 1,
  events: 2,
  day_notes: 2,
  journal_notebooks: 1,
  daily_journals: 2,
  food_items: 1,
  food_log: 2,
  todos: 3,
  note_share_state: 2,
  app_settings: 2,
  weather_daily: 1,
  calendars: 1,
  calendar_events: 1,
  calendar_reminders: 1,
  calendar_occurrence_clears: 1,
};

function clearOptions(overrides: Partial<ClearAppDataOptions>): ClearAppDataOptions {
  return {
    activityHistory: false,
    activityPeriod: { kind: 'all' },
    calendar: false,
    weather: false,
    preferences: false,
    definitions: false,
    ...overrides,
  };
}

interface ClearCase {
  name: string;
  run: (db: SQLiteDatabase) => Promise<void>;
  expected: RowCounts;
}

const CLEAR_CASES: ClearCase[] = [
  {
    name: 'definitions (habits, counters and everything they own)',
    run: () => clearAppData(clearOptions({ definitions: true, activityHistory: true })),
    expected: {
      ...SEEDED,
      elements: 0,
      dashboard_items: 0,
      events: 0,
      day_notes: 0,
      journal_notebooks: 0,
      daily_journals: 0,
      food_items: 0,
      food_log: 0,
      note_share_state: 0,
      // Completed todos are activity and go; the one still open is pending work.
      todos: 1,
    },
  },
  {
    name: 'all activity history, definitions kept',
    run: () => clearAppData(clearOptions({ activityHistory: true })),
    expected: {
      ...SEEDED,
      events: 0,
      day_notes: 0,
      daily_journals: 0,
      food_log: 0,
      note_share_state: 0,
      todos: 1,
    },
  },
  {
    name: 'activity history before a cut-off date',
    run: () =>
      clearAppData(
        clearOptions({
          activityHistory: true,
          activityPeriod: { kind: 'beforeDate', date: CUTOFF },
        }),
      ),
    expected: {
      ...SEEDED,
      events: 1,
      day_notes: 1,
      daily_journals: 1,
      food_log: 1,
      note_share_state: 1,
      // Open todo plus the one completed after the cut-off.
      todos: 2,
    },
  },
  {
    name: 'calendar only',
    run: () => clearAppData(clearOptions({ calendar: true })),
    expected: {
      ...SEEDED,
      calendars: 0,
      calendar_events: 0,
      calendar_reminders: 0,
      calendar_occurrence_clears: 0,
    },
  },
  {
    name: 'weather only',
    run: () => clearAppData(clearOptions({ weather: true })),
    expected: {
      ...SEEDED,
      weather_daily: 0,
      // The cached forecast lives in app_settings and goes with the weather;
      // the theme preference stays.
      app_settings: 1,
    },
  },
  {
    name: 'preferences only',
    run: () => clearAppData(clearOptions({ preferences: true })),
    expected: { ...SEEDED, app_settings: 0 },
  },
  {
    name: 'everything, the way a backup import wipes the device first',
    run: (db) => clearDataForImport(db),
    expected: {
      schema_version: 1,
      elements: 0,
      dashboard_items: 0,
      events: 0,
      day_notes: 0,
      journal_notebooks: 0,
      daily_journals: 0,
      food_items: 0,
      food_log: 0,
      // An import replaces the device, so open todos go too — unlike a
      // definitions clear, which keeps them.
      todos: 0,
      note_share_state: 0,
      app_settings: 0,
      weather_daily: 0,
      calendars: 0,
      calendar_events: 0,
      calendar_reminders: 0,
      calendar_occurrence_clears: 0,
    },
  },
];

/**
 * What survives export + wipe + import. A zero here is not a bug report, it is
 * a fact being pinned: that table is deliberately outside the backup.
 */
const AFTER_ROUND_TRIP: RowCounts = {
  ...SEEDED,
  // Local share fingerprints are a cache, never exported.
  note_share_state: 0,
  // Weather is re-fetched, never exported.
  weather_daily: 0,
  // Only the settings the bundle carries come back (theme), plus the marker
  // saying the imported food catalog is authoritative over the starter list.
  app_settings: 2,
};

describe('persisted tables', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;
  let notebookId: string;

  beforeEach(async () => {
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
    await runMigrations(db);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    const notebook = raw.prepare('SELECT id FROM journal_notebooks LIMIT 1').get() as {
      id: string;
    };
    notebookId = notebook.id;
  });

  afterEach(() => {
    raw.close();
  });

  it('creates exactly the tables this file knows about on a fresh install', () => {
    expect(tableNames(raw)).toEqual([...TABLES].sort());
  });

  describe('fresh install', () => {
    it.each([...TABLES])('creates %s', (table) => {
      expect(tableNames(raw)).toContain(table);
    });
  });

  describe('repair pass', () => {
    it('is a no-op the second time it runs', async () => {
      await seedEveryTable(db, notebookId);

      await ensureSchemaIntegrity(db);
      const schemaAfterFirst = schemaSnapshot(raw);
      const countsAfterFirst = rowCounts(raw);

      await ensureSchemaIntegrity(db);

      expect(schemaSnapshot(raw)).toEqual(schemaAfterFirst);
      expect(rowCounts(raw)).toEqual(countsAfterFirst);
    });

    it('leaves the seeded data intact', async () => {
      await seedEveryTable(db, notebookId);
      await ensureSchemaIntegrity(db);

      expect(rowCounts(raw)).toEqual(SEEDED);
    });
  });

  describe('clear', () => {
    it.each(CLEAR_CASES)('$name', async ({ run, expected }) => {
      await seedEveryTable(db, notebookId);
      expect(rowCounts(raw)).toEqual(SEEDED);

      await run(db);

      expect(rowCounts(raw)).toEqual(expected);
    });
  });

  describe('backup round-trip', () => {
    it('restores every table the bundle carries', async () => {
      await seedEveryTable(db, notebookId);
      const bundle = await exportProtocolBundle();

      await importProtocolBundle(bundle);

      expect(rowCounts(raw)).toEqual(AFTER_ROUND_TRIP);
    });

    it('re-exports byte-identical content', async () => {
      await seedEveryTable(db, notebookId);
      const before = await exportProtocolBundle();

      await importProtocolBundle(before);
      const after = await exportProtocolBundle();

      expect({ ...after, exportedAt: '' }).toEqual({ ...before, exportedAt: '' });
    });
  });
});
