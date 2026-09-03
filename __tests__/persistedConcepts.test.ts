/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrations';
import { ensureSchemaIntegrity } from '../src/db/schemaIntegrity';
import {
  importClearStep,
  PERSISTED_CONCEPTS,
  type PersistedConcept,
  type PersistedConceptName,
} from '../src/db/persistedConcepts';
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
import { FoodItemSchema, HabitConfigSchema, PROTOCOL_VERSION } from '../src/protocol';

/**
 * The guard that makes the next omission impossible.
 *
 * Everything here is driven off `PERSISTED_CONCEPTS`, so declaring a concept is
 * all it takes to be covered — and `SEEDS` is keyed by `PersistedConceptName`,
 * so a new concept fails to compile until someone says how to put a row in it.
 * Between them: every declared concept is created on a fresh install, repaired
 * idempotently, cleared the way it says it is, and round-tripped through a
 * backup the way it says it is.
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

/** Ids the seeds share so their foreign keys line up. */
interface SeedContext {
  elementId: string;
  foodId: string;
  calendarId: string;
  calendarEventId: string;
  /** The notebook the repair pass seeds on a fresh install. */
  notebookId: string;
}

const DATE = '2020-01-01';
const TIME = '2020-01-01T10:00:00.000Z';

function uuid(n: number): string {
  return `550e8400-e29b-41d4-a716-4466554401${String(n).padStart(2, '0')}`;
}

/**
 * How to put at least one row into each concept. Required for every concept:
 * a table nothing can write to cannot be tested for clearing or backup.
 */
const SEEDS: Record<
  PersistedConceptName,
  (db: SQLiteDatabase, ctx: SeedContext) => Promise<void>
> = {
  // Written by runMigrations itself; there is no second row to add.
  schemaVersion: async () => undefined,
  elements: async (db, ctx) => {
    await elementRepo.insertElement(db, {
      id: ctx.elementId,
      kind: 'habit',
      name: 'Meditate',
      config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: TIME,
      archivedAt: null,
    });
  },
  dashboard: async (db, ctx) => {
    await dashboardRepo.insertDashboardItem(db, {
      id: uuid(1),
      elementId: ctx.elementId,
      sortOrder: 0,
    });
  },
  events: async (db, ctx) => {
    await eventRepo.insertEvent(db, {
      id: uuid(2),
      elementId: ctx.elementId,
      timestamp: TIME,
      date: DATE,
      value: 1,
      protocolVersion: PROTOCOL_VERSION,
    });
  },
  dayNotes: async (db, ctx) => {
    await dayNoteRepo.insertNote(db, {
      id: uuid(3),
      elementId: ctx.elementId,
      date: DATE,
      body: 'Felt focused',
      updatedAt: TIME,
      protocolVersion: PROTOCOL_VERSION,
    });
  },
  // The repair pass seeds the default notebook on a fresh install.
  journalNotebooks: async () => undefined,
  dailyJournals: async (db, ctx) => {
    await dailyJournalRepo.insertJournal(db, {
      id: uuid(4),
      notebookId: ctx.notebookId,
      date: DATE,
      body: 'Quiet morning',
      sortOrder: 0,
      createdAt: TIME,
      updatedAt: TIME,
      protocolVersion: PROTOCOL_VERSION,
    });
  },
  foodItems: async (db, ctx) => {
    await foodRepo.insertFoodItem(
      db,
      FoodItemSchema.parse({
        id: ctx.foodId,
        name: 'Carrot',
        group: 'vegetable',
        createdAt: TIME,
        protocolVersion: PROTOCOL_VERSION,
      }),
    );
  },
  foodLog: async (db, ctx) => {
    await foodRepo.insertFoodLogEntry(db, {
      id: uuid(5),
      foodId: ctx.foodId,
      date: DATE,
      loggedAt: TIME,
      protocolVersion: PROTOCOL_VERSION,
    });
  },
  todos: async (db) => {
    // One of each: a definitions clear keeps the open one and drops the done one.
    await todoRepo.insertTodo(db, {
      id: uuid(6),
      title: 'Still open',
      note: null,
      dueDate: null,
      sortOrder: 0,
      createdAt: TIME,
      completedAt: null,
      protocolVersion: PROTOCOL_VERSION,
    });
    await todoRepo.insertTodo(db, {
      id: uuid(7),
      title: 'Done',
      note: null,
      dueDate: null,
      sortOrder: 1,
      createdAt: TIME,
      completedAt: TIME,
      protocolVersion: PROTOCOL_VERSION,
    });
  },
  noteShareState: async (db, ctx) => {
    await noteShareRepo.upsertShareState(
      db,
      { kind: 'tracker', elementId: ctx.elementId, entryId: '' },
      DATE,
      'fingerprint',
    );
  },
  appSettings: async (db) => {
    await settingsRepo.setSetting(db, 'theme_mode', 'dark');
  },
  weather: async (db) => {
    await weatherRepo.upsertWeatherDaily(db, {
      date: DATE,
      tempC: 10,
      tempMinC: 5,
      tempMaxC: 15,
      weatherCode: 0,
      condition: 'sunny',
      precipProbabilityPct: 10,
      lat: 1,
      lon: 2,
      fetchedAt: TIME,
    });
  },
  calendar: async (db, ctx) => {
    await calendarRepo.importCalendarData(db, {
      calendars: [{ id: ctx.calendarId, name: 'Personal', color: '#3D7EA6', source: 'local' }],
      events: [
        {
          id: ctx.calendarEventId,
          calendarId: ctx.calendarId,
          uid: 'uid-1',
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
        { id: uuid(8), eventId: ctx.calendarEventId, offsetMinutes: 30, enabled: true },
      ],
      clearedOccurrences: [
        {
          occurrenceKey: `${ctx.calendarEventId}:${DATE}`,
          eventId: ctx.calendarEventId,
          clearedAt: TIME,
        },
      ],
    });
  },
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

describe('persisted concepts', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;
  let ctx: SeedContext;

  function rowsIn(concept: PersistedConcept): number {
    return concept.tables.reduce((total, table) => {
      const row = raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
      return total + Number(row.n);
    }, 0);
  }

  function schemaOf(concept: PersistedConcept): string[] {
    const placeholders = concept.tables.map(() => '?').join(', ');
    return (
      raw
        .prepare(
          `SELECT type, name, COALESCE(sql, '') AS sql FROM sqlite_master
           WHERE (tbl_name IN (${placeholders})) AND name NOT LIKE 'sqlite_%'
           ORDER BY type, name`,
        )
        .all(...concept.tables) as { type: string; name: string; sql: string }[]
    ).map((row) => `${row.type} ${row.name} ${row.sql.replace(/\s+/g, ' ').trim()}`);
  }

  async function seedEveryConcept(): Promise<void> {
    // Declaration order, so a seed's foreign keys point at rows already written.
    for (const concept of PERSISTED_CONCEPTS) {
      await SEEDS[concept.name](db, ctx);
    }
  }

  beforeEach(async () => {
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
    await runMigrations(db);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    const notebook = raw.prepare('SELECT id FROM journal_notebooks LIMIT 1').get() as {
      id: string;
    };
    ctx = {
      elementId: uuid(90),
      foodId: uuid(91),
      calendarId: uuid(92),
      calendarEventId: uuid(93),
      notebookId: notebook.id,
    };
  });

  afterEach(() => {
    raw.close();
  });

  describe.each(PERSISTED_CONCEPTS)('$name', (concept) => {
    it('has every table created by a fresh install', () => {
      const created = new Set(
        (
          raw
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as { name: string }[]
        ).map((row) => row.name),
      );
      for (const table of concept.tables) {
        expect(created.has(table)).toBe(true);
      }
    });

    it('holds rows once seeded', async () => {
      await seedEveryConcept();

      expect(rowsIn(concept)).toBeGreaterThan(0);
    });

    it('is repaired idempotently', async () => {
      await seedEveryConcept();
      await ensureSchemaIntegrity(db);
      const schema = schemaOf(concept);
      const rows = rowsIn(concept);

      await ensureSchemaIntegrity(db);

      expect(schemaOf(concept)).toEqual(schema);
      expect(rowsIn(concept)).toBe(rows);
    });

    it('loses rows to a definitions clear only if it says it does', async () => {
      await seedEveryConcept();
      const before = rowsIn(concept);

      await clearAppData(clearOptions({ definitions: true, activityHistory: true }));

      if (concept.clear.definitions === 'keep') {
        expect(rowsIn(concept)).toBe(before);
      } else {
        expect(rowsIn(concept)).toBeLessThan(before);
      }
    });

    it('loses rows to an activity clear only if it says it does', async () => {
      await seedEveryConcept();
      const before = rowsIn(concept);

      await clearAppData(clearOptions({ activityHistory: true }));

      if (concept.clear.activity === 'keep') {
        expect(rowsIn(concept)).toBe(before);
      } else {
        expect(rowsIn(concept)).toBeLessThan(before);
      }
    });

    it('is emptied by an import wipe if it declares an import step', async () => {
      await seedEveryConcept();
      const before = rowsIn(concept);

      await clearDataForImport(db);

      expect(rowsIn(concept)).toBe(importClearStep(concept.clear) ? 0 : before);
    });

    it('survives a backup round-trip if it declares a bundle key', async () => {
      await seedEveryConcept();
      const before = rowsIn(concept);
      const bundle = await exportProtocolBundle();

      await importProtocolBundle(bundle);

      if (concept.bundleKey != null) {
        expect(rowsIn(concept)).toBeGreaterThan(0);
      } else {
        // Not in the backup at all, so the import's wipe is the last word on it.
        expect(rowsIn(concept)).toBe(importClearStep(concept.clear) ? 0 : before);
      }
    });
  });

  it('declares every table a fresh install creates', () => {
    const created = (
      raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[]
    ).map((row) => row.name);
    const declared = PERSISTED_CONCEPTS.flatMap((concept) => [...concept.tables]).sort();

    expect(declared).toEqual(created);
  });
});
