import {
  HabitConfigSchema,
  PROTOCOL_VERSION,
  type ElementDefinition,
} from '../src/protocol';
import * as elementRepo from '../src/db/repositories/elementRepository';
import * as eventRepo from '../src/db/repositories/eventRepository';
import { loadTrackerHistory } from '../src/store/trackerHistoryFetch';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

const HABIT = '550e8400-e29b-41d4-a716-446655440801';
const DATES = ['2026-03-08', '2026-03-09', '2026-03-10'];

let testDb: TestDb;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 2, 10, 20, 0, 0), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  testDb = await createMigratedTestDb();
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

async function addHabit(config: unknown): Promise<ElementDefinition> {
  await elementRepo.insertElement(testDb.db, {
    id: HABIT,
    kind: 'habit',
    name: 'Meditate',
    config: HabitConfigSchema.parse(config),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  });
  const element = await elementRepo.getElementById(testDb.db, HABIT);
  if (!element) throw new Error('habit not stored');
  return element;
}

async function logSession(date: string, n: number, seconds: number, trackCompleted: boolean) {
  await eventRepo.insertEvent(testDb.db, {
    id: `550e8400-e29b-41d4-a716-44665544090${n}`,
    elementId: HABIT,
    timestamp: `${date}T07:30:00.000Z`,
    date,
    value: seconds,
    meta: {
      source: 'timer_session',
      startedAt: `${date}T07:00:00.000Z`,
      endedAt: `${date}T07:30:00.000Z`,
      durationSeconds: seconds,
      ...(trackCompleted ? { trackCompleted: true } : {}),
    },
    protocolVersion: PROTOCOL_VERSION,
  });
}

describe('loadTrackerHistory', () => {
  /**
   * A play-once habit is done when its track finishes, which only the event
   * meta knows. History used to count it in the streak (read from events) but
   * not in "days done" (read from totals) on the same screen.
   */
  it('counts a finished play-once day the same in the streak and in days done', async () => {
    const element = await addHabit({
      trackingMode: 'timer',
      timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
    });
    await logSession('2026-03-09', 1, 915, true);
    await logSession('2026-03-10', 2, 915, true);
    await logSession('2026-03-08', 3, 400, false);

    const history = await loadTrackerHistory(testDb.db, element, DATES);

    expect(history.days.map((d) => d.done)).toEqual([false, true, true]);
    expect(history.streak).toBe(2);
    expect(history.personalBest).toBe(2);
    expect(history.days[0]?.facts.total).toBe(400);
  });

  it('fills days with nothing logged as not done', async () => {
    const element = await addHabit({ trackingMode: 'boolean' });

    const history = await loadTrackerHistory(testDb.db, element, DATES);

    expect(history.days.map((d) => [d.date, d.facts.total, d.done])).toEqual([
      ['2026-03-08', 0, false],
      ['2026-03-09', 0, false],
      ['2026-03-10', 0, false],
    ]);
    expect(history.streak).toBe(0);
  });
});

describe('a commitment in History', () => {
  const COMMITMENT = '550e8400-e29b-41d4-a716-446655440811';

  it('shows kept and slipped days, counts none before it existed, and keeps its run', async () => {
    const protocol = await import('../src/protocol');
    await elementRepo.insertElement(testDb.db, {
      id: COMMITMENT,
      kind: 'commitment',
      name: 'No buying',
      config: protocol.CommitmentConfigSchema.parse({ clearSince: '2026-03-08T21:00:00.000Z' }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: new Date(2026, 2, 6, 9, 0).toISOString(),
      archivedAt: null,
    });
    await eventRepo.insertEvent(testDb.db, {
      id: '550e8400-e29b-41d4-a716-446655440812',
      elementId: COMMITMENT,
      timestamp: '2026-03-08T21:00:00.000Z',
      date: '2026-03-08',
      value: 1,
      meta: { source: 'slip' },
      protocolVersion: PROTOCOL_VERSION,
    });
    const element = await elementRepo.getElementById(testDb.db, COMMITMENT);

    const history = await loadTrackerHistory(testDb.db, element!, [
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      ...DATES,
    ]);

    expect(history.days.map(({ date, counted, done }) => [date, counted, done])).toEqual([
      ['2026-03-05', false, false],
      ['2026-03-06', true, true],
      ['2026-03-07', true, true],
      ['2026-03-08', true, false],
      ['2026-03-09', true, true],
      ['2026-03-10', true, true],
    ]);
    expect(history.streak).toBe(2);
    expect(history.personalBest).toBe(2);
  });
});
