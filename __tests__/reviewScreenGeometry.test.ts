/**
 * Where the heat map puts its squares: a month's days in Monday-first weeks,
 * a year's 52 columns fitted to the card, and the month initials over them.
 */
import { reviewPeriod } from '../src/review';
import { calendarWeeks, yearGrid, yearMonthMarks } from '../src/screens/review/reviewGeometry';

/** A Wednesday. */
const TODAY = '2026-11-18';

describe('calendarWeeks', () => {
  it('lays a week out as one row', () => {
    const { days } = reviewPeriod('week', TODAY);
    expect(calendarWeeks(days)).toEqual([days]);
  });

  it('leaves blanks before the 1st and after the last day', () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const weeks = calendarWeeks(reviewPeriod('month', TODAY).days);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[1][0]).toBe('2026-11-02');
    expect(weeks[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });

  it('needs no blanks for a month that fills its weeks', () => {
    // February 2027: Monday the 1st to Sunday the 28th.
    const weeks = calendarWeeks(reviewPeriod('month', '2027-02-10').days);
    expect(weeks).toHaveLength(4);
    expect(weeks.flat()).not.toContain(null);
  });

  it('is empty for no days', () => {
    expect(calendarWeeks([])).toEqual([]);
  });
});

describe('yearGrid', () => {
  it('fits 52 columns in the card of a 360dp phone, with squares still worth drawing', () => {
    // 360 wide, less the page gutters and the card's padding.
    const grid = yearGrid(52, 360 - 2 * 20 - 2 * 12);
    expect(grid.cell).toBeGreaterThanOrEqual(4);
    expect(grid.gap).toBeGreaterThan(0);
    expect(grid.cell + grid.gap).toBeCloseTo(grid.pitch);
    expect(52 * grid.pitch - grid.gap).toBeCloseTo(296);
    expect(grid.height).toBeCloseTo(7 * grid.pitch - grid.gap);
  });

  it('grows its squares with the card', () => {
    expect(yearGrid(52, 616).cell).toBeGreaterThan(yearGrid(52, 296).cell);
  });

  it('draws nothing before it has a width', () => {
    expect(yearGrid(52, 0)).toEqual({ cell: 0, gap: 0, pitch: 0, height: 0 });
    expect(yearGrid(0, 300)).toEqual({ cell: 0, gap: 0, pitch: 0, height: 0 });
  });
});

describe('yearMonthMarks', () => {
  it('marks the column holding each 1st, up to today', () => {
    const marks = yearMonthMarks(reviewPeriod('year', TODAY).days, TODAY);
    expect(marks).toHaveLength(12);
    // The grid starts on Monday 24 November 2025; 1 December opens the next column.
    expect(marks[0]).toEqual({ date: '2025-12-01', column: 1 });
    // 1 November 2026 is a Sunday: the last day of its column.
    expect(marks[11]).toEqual({ date: '2026-11-01', column: 48 });
    expect(marks.map((mark) => mark.column)).toEqual([...marks.map((mark) => mark.column)].sort((a, b) => a - b));
  });

  it('keeps marks at least four columns apart, so initials never collide', () => {
    for (const today of [TODAY, '2027-03-01', '2028-02-29', '2026-12-31']) {
      const columns = yearMonthMarks(reviewPeriod('year', today).days, today).map((mark) => mark.column);
      columns.slice(1).forEach((column, index) => expect(column - columns[index]).toBeGreaterThanOrEqual(4));
    }
  });

  it('does not mark a month that has not started', () => {
    // Monday 30 November: the week runs into December.
    const today = '2026-11-30';
    const marks = yearMonthMarks(reviewPeriod('year', today).days, today);
    expect(marks[marks.length - 1].date).toBe('2026-11-01');
  });
});
