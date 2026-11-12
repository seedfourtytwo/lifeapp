/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * Urges through the real store into a real SQLite: logging is one call,
 * a ride that ends untouched counts as ridden out the next time the app
 * runs, and the count of those only ever grows.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
// The raw copy before a wipe is native; its own tests cover it.
jest.mock('../src/db/safetyCopy', () => ({
  takeSafetyCopy: jest.fn(async () => undefined),
}));

/** Tuesday 10 March 2026, 09:00 local. */
const NOW = new Date(2026, 2, 10, 9, 0);
const TODAY = '2026-03-10';

let testDb: TestDb;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

function urges() {
  return (require('../src/store/urgeStore') as typeof import('../src/store/urgeStore')).useUrgeStore.getState();
}

function rows(): Record<string, unknown>[] {
  return testDb.raw.prepare('SELECT * FROM urges ORDER BY at').all() as Record<string, unknown>[];
}

function minutesLater(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

describe('urges', () => {
  it('logs an urge in one call, open, from the app, and starts its ride', async () => {
    const id = await urges().logUrge();

    expect(rows()).toEqual([
      expect.objectContaining({
        id,
        at: NOW.toISOString(),
        day: TODAY,
        outcome: null,
        resolved_at: null,
        source: 'app',
      }),
    ]);
    expect(urges().ride).toEqual({
      urgeId: id,
      startedAt: NOW.toISOString(),
      endsAt: minutesLater(10).toISOString(),
    });
    expect(urges().urgesToday).toBe(1);
    expect(urges().riddenOutTotal).toBe(0);
  });

  it('resolves an urge as used, which ends the ride and counts nothing ridden out', async () => {
    const id = await urges().logUrge();
    jest.setSystemTime(minutesLater(3));

    await urges().resolveUrge(id!, 'used');

    expect(rows()[0]).toMatchObject({ outcome: 'used', resolved_at: minutesLater(3).toISOString() });
    expect(urges().ride).toBeNull();
    expect(urges().riddenOutTotal).toBe(0);
    expect(urges().urgesToday).toBe(1);
  });

  it('keeps the first outcome when an urge is resolved twice', async () => {
    const id = await urges().logUrge();
    await urges().resolveUrge(id!, 'rode_out');
    await urges().resolveUrge(id!, 'used');

    expect(rows()[0]).toMatchObject({ outcome: 'rode_out' });
  });

  it('leaves the ride running until its very end', async () => {
    await urges().logUrge();
    jest.setSystemTime(new Date(minutesLater(10).getTime() - 1));

    await urges().refresh();

    expect(rows()[0]).toMatchObject({ outcome: null });
    expect(urges().ride).not.toBeNull();
  });

  it('counts a ride that reached its end untouched as ridden out, resolved at the end', async () => {
    await urges().logUrge();
    jest.setSystemTime(minutesLater(10));

    await urges().refresh();

    expect(rows()[0]).toMatchObject({
      outcome: 'rode_out',
      resolved_at: minutesLater(10).toISOString(),
    });
    expect(urges().ride).toBeNull();
    expect(urges().riddenOutTotal).toBe(1);
  });

  it('resolves at the ride end even when the app comes back hours later', async () => {
    await urges().logUrge();
    jest.setSystemTime(minutesLater(300));

    await urges().refresh();

    expect(rows()[0]).toMatchObject({ resolved_at: minutesLater(10).toISOString() });
  });

  it('keeps an urge on the day it was logged when its ride ends after midnight', async () => {
    const lateEvening = new Date(2026, 2, 10, 23, 55);
    jest.setSystemTime(lateEvening);
    await urges().logUrge();
    jest.setSystemTime(new Date(2026, 2, 11, 0, 20));

    await urges().refresh();

    expect(rows()[0]).toMatchObject({
      day: TODAY,
      outcome: 'rode_out',
      resolved_at: new Date(2026, 2, 11, 0, 5).toISOString(),
    });
    expect(urges().urgesToday).toBe(0);
    expect(urges().riddenOutTotal).toBe(1);
  });

  it('does not end a ride when the clock is moved back before it began', async () => {
    await urges().logUrge();
    jest.setSystemTime(minutesLater(-60));

    await urges().refresh();

    expect(rows()[0]).toMatchObject({ outcome: null });
  });

  it('keeps a running total that grows across days and is never reset by a used urge', async () => {
    await urges().logUrge();
    jest.setSystemTime(minutesLater(20));
    await urges().refresh();
    const second = await urges().logUrge();
    await urges().resolveUrge(second!, 'used');
    jest.setSystemTime(new Date(2026, 2, 12, 9, 0));
    await urges().logUrge();
    jest.setSystemTime(new Date(2026, 2, 12, 9, 30));

    await urges().refresh();

    expect(urges().riddenOutTotal).toBe(2);
    expect(urges().urgesToday).toBe(1);
  });

  it('inserts an urge logged elsewhere once, however often it arrives', async () => {
    const elsewhere = {
      id: '550e8400-e29b-41d4-a716-446655443101',
      at: minutesLater(-2).toISOString(),
      day: TODAY,
    };

    await urges().recordLoggedUrge(elsewhere, 'widget');
    await urges().recordLoggedUrge(elsewhere, 'widget');

    expect(rows()).toEqual([expect.objectContaining({ id: elsewhere.id, source: 'widget' })]);
    expect(urges().ride).toMatchObject({ urgeId: elsewhere.id });
  });

  it('is caught up by refreshFromDb', async () => {
    await urges().logUrge();
    jest.setSystemTime(minutesLater(11));
    const { refreshFromDb } = require('../src/hooks/refreshFromDb') as typeof import('../src/hooks/refreshFromDb');

    await refreshFromDb();

    expect(rows()[0]).toMatchObject({ outcome: 'rode_out' });
    expect(urges().riddenOutTotal).toBe(1);
  });

  it('keeps what led to a used urge as its note, on one line', async () => {
    const id = await urges().logUrge();
    await urges().resolveUrge(id!, 'used');

    await urges().noteUrge(id!, '  Long day\n at work  ');

    expect(rows()[0]).toMatchObject({ outcome: 'used', note: 'Long day at work' });
  });

  it('saves no note for an empty line', async () => {
    const id = await urges().logUrge();

    await urges().noteUrge(id!, '   ');

    expect(rows()[0]).toMatchObject({ note: null });
  });

  it('cuts a note at its length limit', async () => {
    const { URGE_NOTE_MAX_LENGTH } = require('../src/protocol/urge') as typeof import('../src/protocol/urge');
    const id = await urges().logUrge();

    await urges().noteUrge(id!, 'a'.repeat(URGE_NOTE_MAX_LENGTH + 20));

    expect(rows()[0]!.note).toBe('a'.repeat(URGE_NOTE_MAX_LENGTH));
  });

  it('logs an urge with no note', async () => {
    await urges().logUrge();

    expect(rows()[0]).toMatchObject({ note: null });
  });

  it('carries the note through a backup, and reads an older backup with none', async () => {
    const id = await urges().logUrge();
    await urges().resolveUrge(id!, 'used');
    await urges().noteUrge(id!, 'Payday');
    const { exportProtocolBundle, importProtocolBundle } = require('../src/db/export') as typeof import('../src/db/export');

    const { bundle } = await exportProtocolBundle();
    expect(bundle.urges).toEqual([expect.objectContaining({ id, note: 'Payday' })]);
    await importProtocolBundle(JSON.parse(JSON.stringify(bundle)));
    expect(rows()).toEqual([expect.objectContaining({ id, note: 'Payday' })]);

    const older = JSON.parse(JSON.stringify(bundle)) as { urges: Record<string, unknown>[] };
    delete older.urges[0]!.note;
    await importProtocolBundle(older);
    expect(rows()).toEqual([expect.objectContaining({ id, outcome: 'used', note: null })]);
  });

  it('reads back how an urge ended', async () => {
    const used = await urges().logUrge();
    await urges().resolveUrge(used!, 'used');
    const open = await urges().logUrge();

    expect(await urges().readOutcome(used!)).toBe('used');
    expect(await urges().readOutcome(open!)).toBeNull();
    expect(await urges().readOutcome('550e8400-e29b-41d4-a716-446655443199')).toBeNull();
  });

  it('blanks itself on reset', async () => {
    await urges().logUrge();

    await urges().reset();

    expect(urges()).toMatchObject({ ride: null, urgesToday: 0, riddenOutTotal: 0, loaded: false });
  });
});
