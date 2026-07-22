import {
  computeActivityStats,
  computePersonalBestStreak,
  movingAverage,
  normalizeSeriesToUnit,
} from '../src/utils/chartStats';

describe('movingAverage', () => {
  it('computes trailing means with a growing leading window', () => {
    expect(movingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });

  it('returns zeros for empty window size', () => {
    expect(movingAverage([1, 2], 0)).toEqual([0, 0]);
  });
});

describe('normalizeSeriesToUnit', () => {
  it('scales each series to its own max', () => {
    expect(normalizeSeriesToUnit([[0, 5, 10], [2, 2, 2]])).toEqual([
      [0, 0.5, 1],
      [1, 1, 1],
    ]);
  });

  it('uses max floor of 1 so empty series stays zero', () => {
    expect(normalizeSeriesToUnit([[0, 0]])).toEqual([[0, 0]]);
  });
});

describe('computeActivityStats', () => {
  it('finds best day and average of active days', () => {
    const stats = computeActivityStats(
      ['2026-01-01', '2026-01-02', '2026-01-03'],
      [0, 4, 6],
    );
    expect(stats.bestValue).toBe(6);
    expect(stats.bestDate).toBe('2026-01-03');
    expect(stats.activeDays).toBe(2);
    expect(stats.averageActive).toBe(5);
  });
});

describe('computePersonalBestStreak', () => {
  it('returns longest consecutive completed run', () => {
    expect(
      computePersonalBestStreak(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06']),
    ).toBe(3);
  });

  it('skips unscheduled gaps without breaking the streak', () => {
    const isScheduled = (date: string) => date !== '2026-01-02';
    expect(
      computePersonalBestStreak(
        ['2026-01-01', '2026-01-03', '2026-01-04'],
        isScheduled,
      ),
    ).toBe(3);
  });

  it('returns 0 for empty input', () => {
    expect(computePersonalBestStreak([])).toBe(0);
  });
});
