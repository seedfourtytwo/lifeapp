/* eslint-disable import/first -- jest mocks must load before module imports */
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
// The raw copy before a wipe is native; its own tests cover it.
jest.mock('../src/db/safetyCopy', () => ({
  takeSafetyCopy: jest.fn(async () => undefined),
}));

import { getDatabase } from '../src/db/client';
import { exportProtocolBundle, importProtocolBundle } from '../src/db/export';
import * as elementRepo from '../src/db/repositories/elementRepository';
import * as settingsRepo from '../src/db/repositories/settingsRepository';
import * as todoRepo from '../src/db/repositories/todoRepository';
import * as dailyJournalRepo from '../src/db/repositories/dailyJournalRepository';
import * as calendarRepo from '../src/db/repositories/calendarRepository';
import { i18n } from '../src/i18n';
import { HabitConfigSchema, PROTOCOL_VERSION, type ProtocolBundle } from '../src/protocol';
import { lifeCore } from '../src/core/lifeCore';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * An import replaces what the file carries and nothing else. A file from
 * before todos (or journals, or the calendar) existed must not erase them.
 */

const HABIT = '550e8400-e29b-41d4-a716-446655440801';
const TODO = '550e8400-e29b-41d4-a716-446655440802';
const JOURNAL = '550e8400-e29b-41d4-a716-446655440803';
const AT = '2026-11-01T08:00:00.000Z';

let testDb: TestDb;

function count(table: string): number {
  return Number((testDb.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
}

/** Only what every backup has ever carried: trackers, the Home order, events. */
function oldestFile(bundle: ProtocolBundle): ProtocolBundle {
  return {
    protocolVersion: bundle.protocolVersion,
    exportedAt: bundle.exportedAt,
    elements: bundle.elements,
    dashboard: bundle.dashboard,
    events: bundle.events,
  };
}

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  (getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await lifeCore.discard();
  const { db } = testDb;
  await elementRepo.insertElement(db, {
    id: HABIT,
    kind: 'habit',
    name: 'Meditate',
    config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'timer', dailyTargetSeconds: 600 }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: AT,
    archivedAt: null,
  });
  await todoRepo.insertTodo(db, {
    id: TODO,
    title: 'Burp the kefir',
    note: null,
    dueDate: null,
    sortOrder: 0,
    createdAt: AT,
    completedAt: null,
    protocolVersion: PROTOCOL_VERSION,
  });
  const notebook = testDb.raw.prepare('SELECT id FROM journal_notebooks LIMIT 1').get() as { id: string };
  await dailyJournalRepo.insertJournal(db, {
    id: JOURNAL,
    notebookId: notebook.id,
    date: '2026-11-01',
    body: 'Slept well',
    sortOrder: 0,
    createdAt: AT,
    updatedAt: AT,
    protocolVersion: PROTOCOL_VERSION,
  });
  await settingsRepo.setSetting(db, 'theme_mode', 'dark');
  await calendarRepo.ensureDefaultCalendar(db);
});

describe('a file that lacks a concept', () => {
  it('leaves todos, journals, the calendar and preferences alone', async () => {
    const calendarsBefore = await calendarRepo.getAllCalendars(testDb.db);
    expect(calendarsBefore).toHaveLength(1);
    const { bundle } = await exportProtocolBundle();

    await importProtocolBundle(oldestFile(bundle));

    expect(count('todos')).toBe(1);
    expect(count('daily_journals')).toBe(1);
    expect(await calendarRepo.getAllCalendars(testDb.db)).toEqual(calendarsBefore);
    expect(await settingsRepo.getSetting(testDb.db, 'theme_mode')).toBe('dark');
    expect(count('elements')).toBe(1);
  });

  it('still replaces a concept the file carries, even when it carries none of it', async () => {
    const { bundle } = await exportProtocolBundle();

    await importProtocolBundle({ ...oldestFile(bundle), todos: [] });

    expect(count('todos')).toBe(0);
    expect(count('daily_journals')).toBe(1);
  });
});

describe('while a timer runs', () => {
  const start = () =>
    lifeCore.start({
      trackerId: HABIT,
      name: 'Meditate',
      lockScreenName: null,
      iconKey: null,
      goal: { type: 'seconds', seconds: 600 },
      trackId: null,
      loop: true,
      loggedSeconds: 0,
    });

  it('refuses, says why, and changes nothing', async () => {
    const { bundle } = await exportProtocolBundle();
    const session = await start();

    await expect(importProtocolBundle({ ...bundle, elements: [], dashboard: [], events: [] })).rejects.toThrow(
      i18n.t('settings:data.importTimerRunning'),
    );

    expect(count('elements')).toBe(1);
    await expect(lifeCore.getState()).resolves.toEqual(session);
  });

  it('refuses while one is paused too, since its seconds are not banked yet', async () => {
    const { bundle } = await exportProtocolBundle();
    await start();
    await lifeCore.pause();

    await expect(importProtocolBundle(bundle)).rejects.toThrow(i18n.t('settings:data.importTimerRunning'));
  });
});
