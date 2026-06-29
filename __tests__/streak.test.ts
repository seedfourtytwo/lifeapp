import { computeStreak, completedDatesFromDailyTotals } from '../src/utils/streak';

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

describe('completedDatesFromDailyTotals', () => {
  it('filters by completion predicate', () => {
    const dates = completedDatesFromDailyTotals(
      [
        { date: '2025-01-01', total: 1 },
        { date: '2025-01-02', total: 0 },
      ],
      (total) => total >= 1,
    );
    expect(dates).toEqual(['2025-01-01']);
  });
});
