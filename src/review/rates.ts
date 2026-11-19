import { shiftDateString } from '../protocol';
import { isMissable, reviewDayStates, type ReviewDay, type ReviewTrackerData } from './dayStates';

export type ReviewRange = 'week' | 'month' | 'year';

/** Days in each rolling range, ending today. */
export const REVIEW_RANGE_DAYS: Readonly<Record<ReviewRange, number>> = {
  week: 7,
  month: 30,
  year: 365,
};

/** Done over due, where due = done + missed. `rate` (0–1) is null when nothing was due. */
export interface CompletionRate {
  done: number;
  due: number;
  rate: number | null;
}

export type ReviewComparison = 'up' | 'down' | 'same' | 'none';

export interface ReviewSlipped {
  trackerId: string;
  done: number;
  due: number;
}

export interface ReviewSummary {
  current: CompletionRate;
  /** The window of equal length immediately before `current`. */
  previous: CompletionRate;
  /** `none` when the window before had fewer than 3 due days; `same` within 1 point. */
  comparison: ReviewComparison;
  /** Lowest-rate tracker with ≥ 3 due days, unless every such tracker is at ≥ 80%. */
  slipped: ReviewSlipped | null;
  /** Something was due and all of it was done. */
  perfect: boolean;
}

const MIN_DUE_TO_COMPARE = 3;
const MIN_DUE_TO_SLIP = 3;
const SLIPPED_BELOW = 0.8;
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
 * The headline over `range` ending `today`, from trackers in the user's order.
 * Only trackers that can miss a day count (habits, counters with a target).
 */
export function reviewSummary(input: {
  trackers: readonly ReviewTrackerData[];
  range: ReviewRange;
  today: string;
}): ReviewSummary {
  const { range, today } = input;
  const length = REVIEW_RANGE_DAYS[range];
  const currentDates = reviewWindowDates(today, length);
  const previousDates = reviewWindowDates(today, length, 1);

  let current = rateOf(0, 0);
  let previous = rateOf(0, 0);
  let slipped: ReviewSlipped | null = null;
  let slippedRate = SLIPPED_BELOW;

  for (const { tracker, history } of input.trackers) {
    if (!isMissable(tracker.rules)) continue;
    const now = completionRate(reviewDayStates(tracker, history, currentDates, today));
    const before = completionRate(reviewDayStates(tracker, history, previousDates, today));
    current = rateOf(current.done + now.done, current.due + now.due);
    previous = rateOf(previous.done + before.done, previous.due + before.due);
    if (now.rate !== null && now.due >= MIN_DUE_TO_SLIP && now.rate < slippedRate) {
      slipped = { trackerId: tracker.id, done: now.done, due: now.due };
      slippedRate = now.rate;
    }
  }

  return {
    current,
    previous,
    comparison: compare(current, previous),
    slipped,
    perfect: current.due > 0 && current.rate === 1,
  };
}
