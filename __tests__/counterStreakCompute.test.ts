import {
  completedDatesFromCounterDailyTotals,
  computeCounterTargetStreak,
} from '../src/utils/counterStreakCompute';

describe('computeCounterTargetStreak', () => {
  it('counts consecutive target-hit days ending today or yesterday', () => {
    const totals = [
      { date: '2026-07-20', total: 50 },
      { date: '2026-07-21', total: 50 },
      { date: '2026-07-22', total: 40 },
      { date: '2026-07-23', total: 50 },
    ];
    expect(computeCounterTargetStreak(totals, 50, '2026-07-23')).toBe(1);
    expect(
      computeCounterTargetStreak(
        [
          { date: '2026-07-21', total: 50 },
          { date: '2026-07-22', total: 50 },
        ],
        50,
        '2026-07-23',
      ),
    ).toBe(2);
  });

  it('returns 0 without a positive target', () => {
    expect(
      computeCounterTargetStreak([{ date: '2026-07-23', total: 10 }], 0, '2026-07-23'),
    ).toBe(0);
  });

  it('lists only days that met the target', () => {
    expect(
      completedDatesFromCounterDailyTotals(
        [
          { date: '2026-07-21', total: 49 },
          { date: '2026-07-22', total: 50 },
        ],
        50,
      ),
    ).toEqual(['2026-07-22']);
  });
});
