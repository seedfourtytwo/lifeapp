import { weekStartDateString } from '../../protocol';
import { REVIEW_RANGE_DAYS, reviewWindowDates, type ReviewRange } from '../../review';

/** Past this the grid stops widening and centres. */
export const REVIEW_MAX_CONTENT_WIDTH = 1040;
/** The statement keeps a readable measure however wide the window is. */
export const REVIEW_MAX_MEASURE = 640;

/** Between two cells or two bars. */
export const CELL_GAP = 1.5;
/** Added before each Monday, so a month reads as weeks. */
export const WEEK_GAP = 5;
/** A day cell narrower than this cannot tell a ring from a fill. */
const MIN_DAY_CELL = 5;
const MONTH_DAYS = 30;
const MONTH_DAYS_NARROW = 28;

const NAME_COLUMN_MIN = 92;
const NAME_COLUMN_MAX = 180;
const NAME_COLUMN_SHARE = 0.18;

/** The ledger's name column: 92 on a phone, growing with the tile up to 180. */
export function nameColumnWidth(tileInnerWidth: number): number {
  return Math.min(NAME_COLUMN_MAX, Math.max(NAME_COLUMN_MIN, tileInnerWidth * NAME_COLUMN_SHARE));
}

/** From this window width the ledger has room for a strength column. */
const STRENGTH_COLUMN_FROM = 720;
const STRENGTH_COLUMN_WIDTH = 80;

/**
 * The strength column after the cells: none on a phone, where a bare score
 * beside the tally reads as noise, and a labelled column on a wide window.
 */
export function strengthColumnWidth(windowWidth: number): number {
  return windowWidth >= STRENGTH_COLUMN_FROM ? STRENGTH_COLUMN_WIDTH : 0;
}

/** Where one cell or bar sits along a row. */
export interface StripSlot {
  x: number;
  width: number;
}

/**
 * Equal cells, one per date, filling `width` with `CELL_GAP` between them and
 * `WEEK_GAP` more before each Monday. The first cell never takes the extra
 * gap: there is no week to its left to part from. Every row of the ledger
 * uses the same slots, so a bad day reads as a column.
 */
export function dayStripSlots(dates: readonly string[], width: number): StripSlot[] {
  const count = dates.length;
  if (count === 0 || width <= 0) return [];
  const startsWeek = dates.map((date, index) => index > 0 && weekStartDateString(date) === date);
  const weekBreaks = startsWeek.filter(Boolean).length;
  const cell = Math.max(0, (width - CELL_GAP * (count - 1) - WEEK_GAP * weekBreaks) / count);
  const slots: StripSlot[] = [];
  let x = 0;
  for (let index = 0; index < count; index++) {
    if (index > 0) x += CELL_GAP + (startsWeek[index] ? WEEK_GAP : 0);
    slots.push({ x, width: cell });
    x += cell;
  }
  return slots;
}

/**
 * How many of a month's 30 days the grid draws: all of them when the cells
 * stay at least 5 wide, else the last 28 — four whole weeks, which a phone
 * fits. Only the drawing narrows; the figures stay on the full 30 days.
 */
export function monthDaysShown(dates: readonly string[], width: number): number {
  const widest = dayStripSlots(dates.slice(-MONTH_DAYS), width)[0]?.width ?? 0;
  return widest >= MIN_DAY_CELL ? MONTH_DAYS : MONTH_DAYS_NARROW;
}

/** `count` equal bars filling `width` with `CELL_GAP` between them. */
export function barSlots(count: number, width: number): StripSlot[] {
  if (count <= 0 || width <= 0) return [];
  const bar = Math.max(0, (width - CELL_GAP * (count - 1)) / count);
  return Array.from({ length: count }, (_, index) => ({ x: index * (bar + CELL_GAP), width: bar }));
}

/** A bar's height for a 0–1 share: never shorter than `min`, `max` at 1. */
export function barHeight(share: number, min: number, max: number): number {
  return min + Math.min(1, Math.max(0, share)) * (max - min);
}

/** A label over the grid: the date it names, and the room it has. */
export interface HeaderMark {
  date: string;
  x: number;
  width: number;
}

/** Each mark runs to the next one; the last runs to the end of the row. */
function runToNext(marks: readonly { date: string; x: number }[], width: number): HeaderMark[] {
  return marks.map((mark, index) => ({
    ...mark,
    width: Math.max(0, (marks[index + 1]?.x ?? width) - mark.x),
  }));
}

/** Week: one mark per day, exactly over its cell. */
export function weekHeaderMarks(dates: readonly string[], slots: readonly StripSlot[]): HeaderMark[] {
  return slots.map((slot, index) => ({ date: dates[index], x: slot.x, width: slot.width }));
}

/** Month: one mark per Monday, starting at its cell. */
export function mondayHeaderMarks(
  dates: readonly string[],
  slots: readonly StripSlot[],
  width: number,
): HeaderMark[] {
  const mondays = slots.flatMap((slot, index) =>
    weekStartDateString(dates[index]) === dates[index] ? [{ date: dates[index], x: slot.x }] : [],
  );
  return runToNext(mondays, width);
}

/** Year: one mark per month, at the week holding that month's first Monday. */
export function monthHeaderMarks(
  weekStarts: readonly string[],
  slots: readonly StripSlot[],
  width: number,
): HeaderMark[] {
  const firstWeeks = slots.flatMap((slot, index) =>
    Number(weekStarts[index].slice(8)) <= 7 ? [{ date: weekStarts[index], x: slot.x }] : [],
  );
  return runToNext(firstWeeks, width);
}

/**
 * The columns every row of the ledger shares for a range: one per day (Week,
 * Month) or one per week (Year), with the labels that go over them.
 */
export interface LedgerColumns {
  /** The days drawn, oldest first; empty for Year, which draws weeks. */
  dates: string[];
  slots: StripSlot[];
  marks: HeaderMark[];
}

export function ledgerColumns(range: ReviewRange, today: string, width: number): LedgerColumns {
  const window = reviewWindowDates(today, REVIEW_RANGE_DAYS[range]);
  if (range === 'year') {
    const weekStarts = [...new Set(window.map(weekStartDateString))];
    const slots = barSlots(weekStarts.length, width);
    return { dates: [], slots, marks: monthHeaderMarks(weekStarts, slots, width) };
  }
  const dates = range === 'month' ? window.slice(-monthDaysShown(window, width)) : window;
  const slots = dayStripSlots(dates, width);
  return {
    dates,
    slots,
    marks: range === 'week' ? weekHeaderMarks(dates, slots) : mondayHeaderMarks(dates, slots, width),
  };
}
