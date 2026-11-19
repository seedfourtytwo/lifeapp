/** The Year strip's weekly bars and the history screen's 53 × 7 heatmap. */
import { shiftDateString } from '../src/protocol';
import { REVIEW_RANGE_DAYS, reviewWindowDates, weeklyBars, yearHeatmap, type ReviewDay } from '../src/review';

const day = (date: string, state: ReviewDay['state']): ReviewDay => ({ date, state });

describe('weeklyBars', () => {
  it('sums each Monday–Sunday week, partial weeks at the edges included', () => {
    const days = [
      day('2026-11-08', 'done'), // Sunday, week of 11-02
      day('2026-11-09', 'done'),
      day('2026-11-10', 'missed'),
      day('2026-11-11', 'skipped'),
      day('2026-11-15', 'missed'),
      day('2026-11-16', 'open'),
      day('2026-11-17', 'none'),
    ];
    expect(weeklyBars(days)).toEqual([
      { weekStart: '2026-11-02', done: 1, due: 1, rate: 1 },
      { weekStart: '2026-11-09', done: 1, due: 3, rate: 1 / 3 },
      { weekStart: '2026-11-16', done: 0, due: 0, rate: null },
    ]);
  });

  it('is empty for no days', () => {
    expect(weeklyBars([])).toEqual([]);
  });

  it('covers a year crossing new year in 53 ordered weeks', () => {
    const dates = reviewWindowDates('2027-01-03', REVIEW_RANGE_DAYS.year);
    const bars = weeklyBars(dates.map((date) => day(date, 'done')));
    expect(bars).toHaveLength(53);
    expect(bars[0].weekStart).toBe('2025-12-29');
    expect(bars[52].weekStart).toBe('2026-12-28');
    expect(bars.reduce((sum, bar) => sum + bar.done, 0)).toBe(365);
  });

  describe('across a DST change', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    it('keeps the change week whole', () => {
      process.env.TZ = 'Europe/London';
      const dates = reviewWindowDates('2026-04-05', 14); // 03-23 … 04-05
      const bars = weeklyBars(dates.map((date) => day(date, 'missed')));
      expect(bars.map((bar) => [bar.weekStart, bar.due])).toEqual([
        ['2026-03-23', 7],
        ['2026-03-30', 7],
      ]);
    });
  });
});

describe('yearHeatmap', () => {
  it('is 53 Monday-first columns of 7, the last holding today', () => {
    const today = '2026-11-18'; // Wednesday
    const dates = reviewWindowDates(today, REVIEW_RANGE_DAYS.year);
    const grid = yearHeatmap(
      dates.map((date) => day(date, date === today ? 'open' : 'done')),
      today,
    );
    expect(grid).toHaveLength(53);
    expect(grid.every((column) => column.days.length === 7)).toBe(true);
    const last = grid[52];
    expect(last.weekStart).toBe('2026-11-16');
    expect(last.days).toEqual(['done', 'done', 'open', null, null, null, null]);
    expect(grid[0].weekStart).toBe(shiftDateString('2026-11-16', -52 * 7));
  });

  it('nulls the cells outside the range and keeps every day inside it', () => {
    const today = '2027-01-03'; // Sunday, after new year
    const dates = reviewWindowDates(today, REVIEW_RANGE_DAYS.year);
    const grid = yearHeatmap(
      dates.map((date) => day(date, 'missed')),
      today,
    );
    const cells = grid.flatMap((column) => column.days);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(365);
    expect(grid[52].weekStart).toBe('2026-12-28');
    expect(grid[52].days[6]).toBe('missed');
    // The range starts on Sunday 2026-01-04: the first column holds only that day.
    expect(grid[0].weekStart).toBe('2025-12-29');
    expect(grid[0].days).toEqual([null, null, null, null, null, null, 'missed']);
  });

  it('is all null for no days', () => {
    const grid = yearHeatmap([], '2026-11-18');
    expect(grid).toHaveLength(53);
    expect(grid.flatMap((column) => column.days).every((cell) => cell === null)).toBe(true);
  });
});
