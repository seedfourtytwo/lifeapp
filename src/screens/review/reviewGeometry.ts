import { daysBetween, weekStartDateString } from '../../protocol';

/** Review is one column; on a wide window it stops here and centres. */
export const REVIEW_MAX_WIDTH = 640;

const DAYS_IN_WEEK = 7;

/**
 * `days` (consecutive, oldest first) as Monday-first weeks. Null is the empty
 * space before the first day and after the last.
 */
export function calendarWeeks(days: readonly string[]): (string | null)[][] {
  if (days.length === 0) return [];
  const lead = daysBetween(weekStartDateString(days[0]), days[0]);
  const slots: (string | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (slots.length % DAYS_IN_WEEK !== 0) slots.push(null);
  const weeks: (string | null)[][] = [];
  for (let start = 0; start < slots.length; start += DAYS_IN_WEEK) {
    weeks.push(slots.slice(start, start + DAYS_IN_WEEK));
  }
  return weeks;
}

/** The squares of a Year: seven rows of `cell`, `gap` apart both ways. */
export interface YearGrid {
  cell: number;
  gap: number;
  /** Cell plus gap: from one column or row to the next. */
  pitch: number;
  height: number;
}

/** The share of a column's pitch left as gap: enough to read squares, not stripes. */
const YEAR_GAP_SHARE = 0.25;

/** `columns` week columns filling `width` exactly, so a year never scrolls. */
export function yearGrid(columns: number, width: number): YearGrid {
  if (columns <= 0 || width <= 0) return { cell: 0, gap: 0, pitch: 0, height: 0 };
  // The last column has no gap after it: `columns` cells and one gap fewer.
  const cell = width / (columns + (columns - 1) * (YEAR_GAP_SHARE / (1 - YEAR_GAP_SHARE)));
  const gap = (cell * YEAR_GAP_SHARE) / (1 - YEAR_GAP_SHARE);
  const pitch = cell + gap;
  return { cell, gap, pitch, height: DAYS_IN_WEEK * pitch - gap };
}

/** A month's initial, over the week column its 1st falls in. */
export interface MonthMark {
  /** The 1st of the month. */
  date: string;
  column: number;
}

/**
 * The month marks of a Year drawn from `days` — whole weeks, oldest first.
 * A month that has not started by `today` gets none.
 */
export function yearMonthMarks(days: readonly string[], today: string): MonthMark[] {
  return days.flatMap((date, index) =>
    date.endsWith('-01') && date <= today ? [{ date, column: Math.floor(index / DAYS_IN_WEEK) }] : [],
  );
}
