import { parseLocalDate, shiftDateString } from '../src/protocol';
import {
  computeStreak,
  computeFailureStreak,
  computeStreakRun,
  computeFailureStreakRun,
} from '../src/utils/streak';

describe('computeStreak', () => {
  it('counts consecutive completed days ending today', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-02', '2025-01-03'],
      '2025-01-03',
    );
    expect(streak).toBe(3);
  });

  it('counts streak ending yesterday when today is not done', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-02'],
      '2025-01-03',
    );
    expect(streak).toBe(2);
  });

  it('stops at the first missed day', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-03'],
      '2025-01-03',
    );
    expect(streak).toBe(1);
  });

  it('skips unscheduled days without breaking the streak', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-03'],
      '2025-01-03',
      (date) => date !== '2025-01-02',
    );
    expect(streak).toBe(2);
  });
});

describe('computeFailureStreak', () => {
  it('returns 0 when today is complete', () => {
    const failureStreak = computeFailureStreak(
      ['2025-01-01', '2025-01-02', '2025-01-03'],
      '2025-01-03',
    );
    expect(failureStreak).toBe(0);
  });

  it('counts consecutive missed days ending yesterday', () => {
    const failureStreak = computeFailureStreak(
      ['2025-01-01'],
      '2025-01-04',
    );
    expect(failureStreak).toBe(2);
  });

  it('stops at the first completed day', () => {
    const failureStreak = computeFailureStreak(
      ['2025-01-01', '2025-01-03'],
      '2025-01-05',
    );
    expect(failureStreak).toBe(1);
  });

  it('ignores misses before createdOn', () => {
    const failureStreak = computeFailureStreak(
      [],
      '2025-01-10',
      () => true,
      365,
      '2025-01-08',
    );
    // Jan 8 and 9 missed; days before creation ignored.
    expect(failureStreak).toBe(2);
  });
});

describe('streaks are not capped by lookback', () => {
  const addDays = (date: string, n: number) => shiftDateString(date, n);
  const today = '2026-06-01';

  it('counts a daily run longer than 365 days', () => {
    const done = Array.from({ length: 500 }, (_, i) => addDays(today, -i));
    expect(computeStreak(done, today)).toBe(500);
  });

  it('does not let unscheduled days eat the budget (3 days a week)', () => {
    const isScheduled = (d: string) => [1, 3, 5].includes(parseLocalDate(d).getDay());
    const done: string[] = [];
    for (let i = 0; i < 1100; i++) {
      const d = addDays(today, -i);
      if (isScheduled(d)) done.push(d);
    }
    expect(computeStreak(done, today, isScheduled)).toBe(done.length);
    expect(done.length).toBeGreaterThan(156 * 2);
  });

  it('counts a long failure streak past 365 days', () => {
    expect(computeFailureStreak([], today)).toBeGreaterThan(365);
  });

  it('still honours an explicit maxLookback of scheduled days', () => {
    const done = Array.from({ length: 50 }, (_, i) => addDays(today, -i));
    expect(computeStreak(done, today, () => true, 10)).toBe(10);
  });

  it('terminates when nothing is ever scheduled', () => {
    expect(computeStreak([], today, () => false)).toBe(0);
  });

  it('reports truncation only when the run is unbroken at the window edge', () => {
    const done = Array.from({ length: 10 }, (_, i) => addDays(today, -i));
    const edge = addDays(today, -5);
    expect(computeStreakRun(done, today, () => true, undefined, null, edge)).toEqual({
      count: 6,
      truncated: true,
    });
    const broken = done.filter((d) => d !== addDays(today, -3));
    expect(computeStreakRun(broken, today, () => true, undefined, null, edge)).toEqual({
      count: 3,
      truncated: false,
    });
    expect(computeStreakRun(done, today, () => true, undefined, addDays(today, -5), edge)).toEqual({
      count: 6,
      truncated: false,
    });
    expect(computeFailureStreakRun([], today, () => true, undefined, null, edge).truncated).toBe(
      true,
    );
  });
});
