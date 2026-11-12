/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';
import type { CommitmentElement } from '../src/protocol';

/**
 * The commitment through the real element store into a real SQLite: one at
 * a time, its instead-habits checked when saved, and a slip that moves the
 * clock and leaves everything else standing.
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

let testDb: TestDb;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await seedRealisticTrackers(testDb.db);
  await elements().load();
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

function elements() {
  return (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore.getState();
}

function events() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore.getState();
}

function urges() {
  return (require('../src/store/urgeStore') as typeof import('../src/store/urgeStore')).useUrgeStore.getState();
}

function commitment(): CommitmentElement {
  const found = elements().elements.find(
    (element): element is CommitmentElement => element.kind === 'commitment' && element.archivedAt == null,
  );
  if (!found) throw new Error('no commitment');
  return found;
}

function slipRows(): Record<string, unknown>[] {
  return testDb.raw
    .prepare('SELECT * FROM events WHERE element_id = ? ORDER BY timestamp')
    .all(commitment().id) as Record<string, unknown>[];
}

const input = { name: 'No buying', ownLines: [], insteadHabitIds: [] };

describe('the commitment', () => {
  it('is created clear from now, named Clear on a locked phone, and placed on Home', async () => {
    await elements().createCommitment(input);

    expect(commitment()).toMatchObject({
      kind: 'commitment',
      name: 'No buying',
      config: {
        lockScreenName: 'Clear',
        clearSince: NOW.toISOString(),
        ownLines: [],
        insteadHabitIds: [],
        rideSeconds: 600,
      },
    });
    expect(elements().dashboard.some((item) => item.elementId === commitment().id)).toBe(true);
  });

  it('is one at a time: a second is refused with a plain message', async () => {
    await elements().createCommitment(input);

    await expect(elements().createCommitment({ ...input, name: 'Another' })).rejects.toThrow(
      'There is already a commitment. Archive it before starting another.',
    );
    expect(elements().elements.filter((element) => element.kind === 'commitment')).toHaveLength(1);
  });

  it('can be started again once the first is archived, and the archived one not restored beside it', async () => {
    await elements().createCommitment(input);
    const first = commitment().id;
    await elements().archiveElement(first);

    await elements().createCommitment({ ...input, name: 'Second' });

    await expect(elements().restoreElement(first)).rejects.toThrow('There is already a commitment');
    expect(elements().elements.find((element) => element.id === first)?.archivedAt).not.toBeNull();
  });

  it('takes timed habits as instead-habits and refuses anything else when saved', async () => {
    await elements().createCommitment({ ...input, insteadHabitIds: [TRACKERS.meditation, TRACKERS.breathing] });
    expect(commitment().config.insteadHabitIds).toEqual([TRACKERS.meditation, TRACKERS.breathing]);

    await expect(
      elements().updateCommitment(commitment().id, { ...input, insteadHabitIds: [TRACKERS.kefir] }),
    ).rejects.toThrow('An instead-habit has to be a timed habit.');
    await expect(
      elements().updateCommitment(commitment().id, {
        ...input,
        insteadHabitIds: ['550e8400-e29b-41d4-a716-446655449999'],
      }),
    ).rejects.toThrow('An instead-habit is no longer there. Pick it again.');
  });

  it('keeps an instead-habit deleted later, reading around it', async () => {
    await elements().createCommitment({ ...input, insteadHabitIds: [TRACKERS.meditation] });
    await elements().deleteElement(TRACKERS.meditation);
    await elements().load();

    expect(commitment().config.insteadHabitIds).toEqual([TRACKERS.meditation]);
  });

  it('moves its clock and ride length when the editor chose them', async () => {
    await elements().createCommitment(input);
    const earlier = new Date(2026, 2, 8, 21, 30).toISOString();

    await elements().updateCommitment(commitment().id, { ...input, clearSince: earlier, rideSeconds: 1500 });
    await elements().load();

    expect(commitment().config).toMatchObject({ clearSince: earlier, rideSeconds: 1500 });
  });

  it('keeps its clear-since when edited', async () => {
    await elements().createCommitment(input);
    jest.setSystemTime(new Date(2026, 2, 12, 9, 0));

    await elements().updateCommitment(commitment().id, {
      ...input,
      name: 'No buying, ever',
      lockScreenName: 'Steady',
      ownLines: ['I sleep better'],
    });

    expect(commitment()).toMatchObject({
      name: 'No buying, ever',
      config: { clearSince: NOW.toISOString(), lockScreenName: 'Steady', ownLines: ['I sleep better'] },
    });
  });

  it('logs a slip: appended, clear-since moved to it, today not kept', async () => {
    await elements().createCommitment(input);
    const slipAt = new Date(2026, 2, 12, 22, 0);
    jest.setSystemTime(slipAt);

    await elements().logSlip(commitment().id);

    expect(commitment().config.clearSince).toBe(slipAt.toISOString());
    expect(slipRows()).toEqual([
      expect.objectContaining({ date: '2026-03-12', value: 1, timestamp: slipAt.toISOString() }),
    ]);
    expect(events().dailyTotals[commitment().id]).toBe(1);
  });

  it('undoes a slip logged by mistake: the slip gone, clear-since back where it was', async () => {
    await elements().createCommitment(input);
    const before = commitment().config.clearSince;
    jest.setSystemTime(new Date(2026, 2, 12, 22, 0));

    const undo = await elements().logSlip(commitment().id);
    await undo();

    expect(commitment().config.clearSince).toBe(before);
    expect(slipRows()).toEqual([]);
    expect(events().dailyTotals[commitment().id]).toBe(0);
  });

  it('an Undo after a later slip takes back only its own slip', async () => {
    await elements().createCommitment(input);
    jest.setSystemTime(new Date(2026, 2, 12, 22, 0));
    const undoFirst = await elements().logSlip(commitment().id);
    const later = new Date(2026, 2, 12, 23, 0);
    jest.setSystemTime(later);
    await elements().logSlip(commitment().id);

    await undoFirst();

    expect(commitment().config.clearSince).toBe(later.toISOString());
    expect(slipRows()).toEqual([expect.objectContaining({ timestamp: later.toISOString() })]);
  });

  it('never takes back an earlier slip or an urge ridden out', async () => {
    await elements().createCommitment(input);
    await urges().logUrge();
    jest.setSystemTime(new Date(NOW.getTime() + 20 * 60_000));
    await urges().refresh();
    await elements().logSlip(commitment().id);
    jest.setSystemTime(new Date(2026, 2, 14, 9, 0));

    await elements().logSlip(commitment().id);
    await urges().refresh();

    expect(slipRows()).toHaveLength(2);
    expect(urges().riddenOutTotal).toBe(1);
  });

  it('sets the ride of an urge to its own ride length', async () => {
    await elements().createCommitment(input);
    const db = testDb.db;
    const elementRepo = require('../src/db/repositories/elementRepository') as typeof import('../src/db/repositories/elementRepository');
    await elementRepo.updateElement(
      db,
      commitment().id,
      { name: 'No buying', config: { ...commitment().config, rideSeconds: 300 } },
      'commitment',
    );

    await urges().logUrge();

    expect(urges().ride?.endsAt).toBe(new Date(NOW.getTime() + 300_000).toISOString());
  });

  it("shows today's slips after refreshFromDb", async () => {
    await elements().createCommitment(input);
    const { refreshFromDb } = require('../src/hooks/refreshFromDb') as typeof import('../src/hooks/refreshFromDb');
    await refreshFromDb();
    expect(events().dailyTotals[commitment().id]).toBe(0);

    await elements().logSlip(commitment().id);
    await events().reset();
    await refreshFromDb();

    expect(events().dailyTotals[commitment().id]).toBe(1);
  });

  it('comes back from a backup with its slips, clear-since and urges', async () => {
    await elements().createCommitment({ ...input, ownLines: ['I sleep better'] });
    await urges().logUrge();
    jest.setSystemTime(new Date(2026, 2, 11, 9, 0));
    await elements().logSlip(commitment().id);
    const before = commitment();
    const { exportProtocolBundle, importProtocolBundle } = require('../src/db/export') as typeof import('../src/db/export');
    const { bundle } = await exportProtocolBundle();
    const { clearAllAppData } = require('../src/db/resetAppData') as typeof import('../src/db/resetAppData');
    await clearAllAppData();

    await importProtocolBundle(JSON.parse(JSON.stringify(bundle)));
    await elements().load();

    expect(commitment()).toEqual(before);
    expect(slipRows()).toHaveLength(1);
    expect(testDb.raw.prepare('SELECT COUNT(*) AS n FROM urges').get()).toEqual({ n: 1 });
  });
});
