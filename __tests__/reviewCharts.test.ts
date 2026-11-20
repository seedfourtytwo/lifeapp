/** The history screen's 53 × 7 heatmap. */
import { shiftDateString } from '../src/protocol';
import { reviewWindowDates, yearHeatmap, type ReviewDay } from '../src/review';

const day = (date: string, state: ReviewDay['state']): ReviewDay => ({ date, state });

describe('yearHeatmap', () => {
  it('is 53 Monday-first columns of 7, the last holding today', () => {
    const today = '2026-11-18'; // Wednesday
    const dates = reviewWindowDates(today, 365);
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
    const dates = reviewWindowDates(today, 365);
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
