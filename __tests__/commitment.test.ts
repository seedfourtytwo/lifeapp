import {
  CommitmentConfigSchema,
  currentOwnLine,
  insteadHabitIdsProblem,
  lampHours,
  lampsPassed,
  nextLamp,
  usableInsteadHabits,
} from '../src/protocol/kinds/commitment';
import {
  CounterConfigSchema,
  HabitConfigSchema,
  PROTOCOL_VERSION,
  dayOutcome,
  factsFromTotal,
  type ElementDefinition,
} from '../src/protocol';

const CLEAR_SINCE = '2026-03-01T20:00:00.000Z';
const HOUR = 3_600_000;

function hoursAfter(hours: number, from = CLEAR_SINCE): Date {
  return new Date(Date.parse(from) + hours * HOUR);
}

function config(overrides: Record<string, unknown> = {}) {
  return CommitmentConfigSchema.parse({ clearSince: CLEAR_SINCE, ...overrides });
}

describe('the commitment config', () => {
  it('fills in a neutral lock-screen name, no lines, no instead-habits and a ten-minute ride', () => {
    expect(config()).toEqual({
      lockScreenName: 'Clear',
      clearSince: CLEAR_SINCE,
      ownLines: [],
      insteadHabitIds: [],
      rideSeconds: 600,
    });
  });

  it('keeps a lock-screen name to twenty characters, and falls back to Clear when blank', () => {
    expect(config({ lockScreenName: '  Steady  ' }).lockScreenName).toBe('Steady');
    expect(config({ lockScreenName: 'x'.repeat(30) }).lockScreenName).toHaveLength(20);
    expect(config({ lockScreenName: '   ' }).lockScreenName).toBe('Clear');
  });

  it('takes up to five own lines of up to eighty characters, trimmed', () => {
    expect(config({ ownLines: ['  one  ', 'two'] }).ownLines).toEqual(['one', 'two']);
    expect(() => config({ ownLines: ['1', '2', '3', '4', '5', '6'] })).toThrow();
    expect(() => config({ ownLines: ['x'.repeat(81)] })).toThrow();
    expect(() => config({ ownLines: ['  '] })).toThrow();
    expect(config({ ownLines: ['x'.repeat(80)] }).ownLines[0]).toHaveLength(80);
  });

  it('takes at most two instead-habits, each once', () => {
    const a = '550e8400-e29b-41d4-a716-446655444001';
    const b = '550e8400-e29b-41d4-a716-446655444002';
    const c = '550e8400-e29b-41d4-a716-446655444003';
    expect(config({ insteadHabitIds: [a, b] }).insteadHabitIds).toEqual([a, b]);
    expect(() => config({ insteadHabitIds: [a, b, c] })).toThrow();
    expect(() => config({ insteadHabitIds: [a, a] })).toThrow();
  });

  it('keeps the ride between one minute and an hour', () => {
    expect(config({ rideSeconds: 60 }).rideSeconds).toBe(60);
    expect(config({ rideSeconds: 3600 }).rideSeconds).toBe(3600);
    expect(() => config({ rideSeconds: 59 })).toThrow();
    expect(() => config({ rideSeconds: 3601 })).toThrow();
  });
});

describe('lamps', () => {
  it('fall at 24 h, 48 h, 3, 5, 7, 10 and 14 days, then every 7 days', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lampHours)).toEqual([
      24, 48, 72, 120, 168, 240, 336, 504, 672, 840,
    ]);
  });

  it('are not passed a moment before, and passed exactly at, their hour', () => {
    expect(lampsPassed(CLEAR_SINCE, new Date(hoursAfter(24).getTime() - 1))).toBe(0);
    expect(lampsPassed(CLEAR_SINCE, hoursAfter(24))).toBe(1);
    expect(lampsPassed(CLEAR_SINCE, hoursAfter(336))).toBe(7);
    expect(lampsPassed(CLEAR_SINCE, new Date(hoursAfter(504).getTime() - 1))).toBe(7);
    expect(lampsPassed(CLEAR_SINCE, hoursAfter(504))).toBe(8);
  });

  it('are none passed when the clock reads before clear-since', () => {
    expect(lampsPassed(CLEAR_SINCE, hoursAfter(-5))).toBe(0);
    expect(nextLamp(CLEAR_SINCE, hoursAfter(-5))).toEqual({ at: hoursAfter(24), hours: 24 });
  });

  it('name the next lamp and when it falls', () => {
    expect(nextLamp(CLEAR_SINCE, hoursAfter(0))).toEqual({ at: hoursAfter(24), hours: 24 });
    expect(nextLamp(CLEAR_SINCE, hoursAfter(24))).toEqual({ at: hoursAfter(48), hours: 48 });
    expect(nextLamp(CLEAR_SINCE, hoursAfter(130))).toEqual({ at: hoursAfter(168), hours: 168 });
    expect(nextLamp(CLEAR_SINCE, hoursAfter(400))).toEqual({ at: hoursAfter(504), hours: 504 });
  });
});

describe('the own line shown', () => {
  const lines = config({ ownLines: ['first', 'second', 'third'] });

  it('is none without lines', () => {
    expect(currentOwnLine(config(), hoursAfter(100))).toBeNull();
  });

  it('stays the same between lamps', () => {
    expect(currentOwnLine(lines, hoursAfter(1))).toBe('first');
    expect(currentOwnLine(lines, new Date(hoursAfter(24).getTime() - 1))).toBe('first');
  });

  it('moves on at each lamp, and comes round again', () => {
    expect(currentOwnLine(lines, hoursAfter(24))).toBe('second');
    expect(currentOwnLine(lines, hoursAfter(48))).toBe('third');
    expect(currentOwnLine(lines, hoursAfter(72))).toBe('first');
  });
});

describe('a commitment day', () => {
  const commitment = { kind: 'commitment' as const, config: config() };

  it('is done when it holds no slip', () => {
    expect(dayOutcome(commitment, factsFromTotal(0))).toEqual({ total: 0, done: true, reason: 'clear' });
  });

  it('is not done when it holds a slip, or several', () => {
    expect(dayOutcome(commitment, factsFromTotal(1))).toEqual({ total: 1, done: false, reason: 'slipped' });
    expect(dayOutcome(commitment, factsFromTotal(2)).done).toBe(false);
  });
});

describe('instead-habits', () => {
  const TIMER = '550e8400-e29b-41d4-a716-446655444011';
  const TICK = '550e8400-e29b-41d4-a716-446655444012';
  const COUNTER = '550e8400-e29b-41d4-a716-446655444013';
  const ARCHIVED = '550e8400-e29b-41d4-a716-446655444014';
  const GONE = '550e8400-e29b-41d4-a716-446655444015';
  const base = { protocolVersion: PROTOCOL_VERSION, createdAt: CLEAR_SINCE, archivedAt: null };
  const elements: ElementDefinition[] = [
    { ...base, id: TIMER, kind: 'habit', name: 'Yoga', config: HabitConfigSchema.parse({ trackingMode: 'timer' }) },
    { ...base, id: TICK, kind: 'habit', name: 'Kefir', config: HabitConfigSchema.parse({}) },
    {
      ...base,
      id: COUNTER,
      kind: 'counter',
      name: 'Water',
      config: CounterConfigSchema.parse({ unit: 'glasses', quickIncrements: [1] }),
    },
    {
      ...base,
      id: ARCHIVED,
      kind: 'habit',
      name: 'Walk',
      archivedAt: CLEAR_SINCE,
      config: HabitConfigSchema.parse({ trackingMode: 'timer' }),
    },
  ];

  it('are accepted at save only when each is a timed habit on Home', () => {
    expect(insteadHabitIdsProblem([TIMER], elements)).toBeNull();
    expect(insteadHabitIdsProblem([], elements)).toBeNull();
    expect(insteadHabitIdsProblem([TICK], elements)).toBe('not_a_timer');
    expect(insteadHabitIdsProblem([COUNTER], elements)).toBe('not_a_timer');
    expect(insteadHabitIdsProblem([GONE], elements)).toBe('missing');
    expect(insteadHabitIdsProblem([ARCHIVED], elements)).toBe('missing');
  });

  it('leave out one deleted, archived or changed since, when read', () => {
    const ids = (insteadHabitIds: string[]) =>
      usableInsteadHabits(config({ insteadHabitIds }), elements).map((habit) => habit.id);
    expect(ids([GONE, TIMER])).toEqual([TIMER]);
    expect(ids([TICK, TIMER])).toEqual([TIMER]);
    expect(ids([ARCHIVED])).toEqual([]);
  });
});
