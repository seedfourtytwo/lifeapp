import { shiftDateString, weekStartDateString } from '../protocol';
import { isMissable, reviewDayStates, type ReviewDay, type ReviewTrackerData } from './dayStates';

export type ReviewRange = 'week' | 'month' | 'year';

/** Done over due, where due = done + missed. `rate` (0–1) is null when nothing was due. */
export interface CompletionRate {
  done: number;
  due: number;
  rate: number | null;
}

export type ReviewComparison = 'up' | 'down' | 'same' | 'none';

export interface ReviewSummary {
  current: CompletionRate;
  /** The period just before `current`. */
  previous: CompletionRate;
  /** `none` when the period before had fewer than 3 due days; `same` within 1 point. */
  comparison: ReviewComparison;
  /** Something was due and all of it was done. */
  perfect: boolean;
}

const MIN_DUE_TO_COMPARE = 3;
/** Rates closer than this (one percentage point) read as the same. */
const SAME_WITHIN = 0.01;

function rateOf(done: number, due: number): CompletionRate {
  return { done, due, rate: due === 0 ? null : done / due };
}

export function completionRate(days: readonly ReviewDay[]): CompletionRate {
  let done = 0;
  let missed = 0;
  for (const { state } of days) {
    if (state === 'done') done++;
    else if (state === 'missed') missed++;
  }
  return rateOf(done, done + missed);
}

/**
 * The `length` dates of a rolling window ending `today`, oldest first;
 * `windowsBack` steps back whole windows (1 = the window just before).
 */
export function reviewWindowDates(today: string, length: number, windowsBack = 0): string[] {
  const end = shiftDateString(today, -length * windowsBack);
  const dates: string[] = [];
  for (let offset = length - 1; offset >= 0; offset--) dates.push(shiftDateString(end, -offset));
  return dates;
}

/** Week columns in a Year: GitHub's 52, the last of them this week. */
export const REVIEW_YEAR_WEEKS = 52;
const DAYS_IN_WEEK = 7;

/** The days a range covers, and the period it is compared with. */
export interface ReviewPeriod {
  /** Every day the range draws, oldest first — the ones after today included. */
  days: string[];
  /** The whole period just before, oldest first. */
  previous: string[];
}

/** The `count` dates from `first` on. */
function datesFrom(first: string, count: number): string[] {
  return Array.from({ length: count }, (_, offset) => shiftDateString(first, offset));
}

/** Every date of the calendar month holding `date`. */
function monthDates(date: string): string[] {
  const month = date.slice(0, 7);
  const dates: string[] = [];
  for (let day = `${month}-01`; day.startsWith(month); day = shiftDateString(day, 1)) dates.push(day);
  return dates;
}

/**
 * What each range means as of `today`: the Monday–Sunday week holding it
 * against the week before; its calendar month against the month before; and
 * the 52 weeks ending with this one against the 52 before those.
 */
export function reviewPeriod(range: ReviewRange, today: string): ReviewPeriod {
  if (range === 'month') {
    const days = monthDates(today);
    return { days, previous: monthDates(shiftDateString(days[0], -1)) };
  }
  const length = range === 'week' ? DAYS_IN_WEEK : REVIEW_YEAR_WEEKS * DAYS_IN_WEEK;
  const first = shiftDateString(weekStartDateString(today), DAYS_IN_WEEK - length);
  return { days: datesFrom(first, length), previous: datesFrom(shiftDateString(first, -length), length) };
}

function compare(current: CompletionRate, previous: CompletionRate): ReviewComparison {
  if (previous.due < MIN_DUE_TO_COMPARE || current.rate === null || previous.rate === null) {
    return 'none';
  }
  const diff = current.rate - previous.rate;
  // Rounded so a float like 0.29 − 0.28 = 0.00999… still reads as one point.
  if (Math.round(Math.abs(diff) * 1e9) < Math.round(SAME_WITHIN * 1e9)) return 'same';
  return diff > 0 ? 'up' : 'down';
}

/**
 * The headline over `period` as of `today`, from trackers in the user's order.
 * Only trackers that can miss a day count (habits, counters with a target),
 * and only days up to today: one that has not come yet is not due.
 */
export function reviewSummary(input: {
  trackers: readonly ReviewTrackerData[];
  period: ReviewPeriod;
  today: string;
}): ReviewSummary {
  const { period, today } = input;
  let current = rateOf(0, 0);
  let previous = rateOf(0, 0);

  for (const { tracker, history } of input.trackers) {
    if (!isMissable(tracker.rules)) continue;
    const now = completionRate(reviewDayStates(tracker, history, period.days, today));
    const before = completionRate(reviewDayStates(tracker, history, period.previous, today));
    current = rateOf(current.done + now.done, current.due + now.due);
    previous = rateOf(previous.done + before.done, previous.due + before.due);
  }

  return {
    current,
    previous,
    comparison: compare(current, previous),
    perfect: current.due > 0 && current.rate === 1,
  };
}
