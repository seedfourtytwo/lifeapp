import { daysBetween, weekStartDateString } from '../protocol';
import { isMissable, reviewDayStates, type ReviewTrackerData } from './dayStates';

/**
 * One day across every tracker that can miss a day. `planned` is what was
 * asked of the day — done, missed, and on today what is still `open`. A
 * skipped item is left out of it, so a day skipped whole plans nothing.
 */
export interface DayTally {
  date: string;
  done: number;
  planned: number;
  /** Today's items not done yet: planned, but not missed. Zero on any other day. */
  open: number;
}

/** The tally of each of `dates`, in their order. A day after today plans nothing. */
export function dayTallies(
  trackers: readonly ReviewTrackerData[],
  dates: readonly string[],
  today: string,
): DayTally[] {
  const tallies = dates.map((date) => ({ date, done: 0, planned: 0, open: 0 }));
  for (const { tracker, history } of trackers) {
    if (!isMissable(tracker.rules)) continue;
    reviewDayStates(tracker, history, dates, today).forEach(({ state }, index) => {
      const tally = tallies[index];
      if (state === 'done') tally.done++;
      if (state === 'open') tally.open++;
      if (state === 'done' || state === 'missed' || state === 'open') tally.planned++;
    });
  }
  return tallies;
}

/** A heat map shade: 0 is nothing done (or nothing planned), 4 everything. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** The share of the day's plan that was done, in four steps above none. */
export function heatLevel({ done, planned }: DayTally): HeatLevel {
  if (planned === 0 || done === 0) return 0;
  const share = done / planned;
  if (share >= 1) return 4;
  if (share >= 0.67) return 3;
  return share >= 0.34 ? 2 : 1;
}

/** Something was planned and all of it was done. */
export function isFullDay({ done, planned }: DayTally): boolean {
  return planned > 0 && done === planned;
}

export interface DayCounts {
  full: number;
  /** Some of the plan done, not all. */
  partial: number;
  /** A plan, and none of it done. Today is not one while it is still open. */
  empty: number;
}

/** How the days with a plan went. Days with nothing planned are in no count. */
export function dayCounts(tallies: readonly DayTally[]): DayCounts {
  const counts: DayCounts = { full: 0, partial: 0, empty: 0 };
  for (const tally of tallies) {
    if (isFullDay(tally)) counts.full++;
    else if (tally.done > 0) counts.partial++;
    else if (tally.planned > tally.open) counts.empty++;
  }
  return counts;
}

/**
 * Full days in a row up to now, from `tallies` oldest first. Today counts once
 * it is full and never breaks the run before that; a day with nothing planned
 * neither counts nor breaks it.
 */
export function fullDayRun(tallies: readonly DayTally[], today: string): number {
  let run = 0;
  for (let index = tallies.length - 1; index >= 0; index--) {
    const tally = tallies[index];
    if (tally.date > today || tally.planned === 0) continue;
    if (isFullDay(tally)) run++;
    else if (tally.date !== today) break;
  }
  return run;
}

const DAYS_IN_WEEK = 7;
/** A weekday seen once says nothing about the weekday. */
const MIN_DAYS_PER_WEEKDAY = 2;
/** One weekday alone has nothing to be the best of. */
const MIN_WEEKDAYS_TO_RANK = 2;

/**
 * The weekday (0 = Monday) with the highest share done over `tallies`, each
 * weekday pooled as done over what was due. Only weekdays with a plan on two
 * or more days are ranked, and it takes two of them to name a best; a tie goes
 * to the earlier weekday. Null when that is too little to say, or when nothing
 * was done at all.
 */
export function bestWeekday(tallies: readonly DayTally[]): number | null {
  const byWeekday = Array.from({ length: DAYS_IN_WEEK }, () => ({ done: 0, due: 0, days: 0 }));
  for (const { date, done, planned, open } of tallies) {
    const due = planned - open;
    if (due === 0) continue;
    const weekday = byWeekday[daysBetween(weekStartDateString(date), date)];
    weekday.done += done;
    weekday.due += due;
    weekday.days++;
  }

  let best: number | null = null;
  let bestShare = 0;
  let ranked = 0;
  byWeekday.forEach(({ done, due, days }, weekday) => {
    if (days < MIN_DAYS_PER_WEEKDAY) return;
    ranked++;
    if (done / due > bestShare) {
      best = weekday;
      bestShare = done / due;
    }
  });
  return ranked >= MIN_WEEKDAYS_TO_RANK ? best : null;
}

/** How one tracker did over a range: done over planned days, skips left out. */
export interface TrackerStanding {
  trackerId: string;
  done: number;
  /** Done plus missed. Today while it is open is not in it. */
  planned: number;
  skipped: number;
  /** `done / planned`, 0–1. */
  share: number;
}

/**
 * The trackers with something planned over `dates`, best share first; a tie
 * goes to the larger plan, then to the user's order.
 */
export function trackerStandings(
  trackers: readonly ReviewTrackerData[],
  dates: readonly string[],
  today: string,
): TrackerStanding[] {
  const standings: TrackerStanding[] = [];
  for (const { tracker, history } of trackers) {
    if (!isMissable(tracker.rules)) continue;
    let done = 0;
    let missed = 0;
    let skipped = 0;
    for (const { state } of reviewDayStates(tracker, history, dates, today)) {
      if (state === 'done') done++;
      else if (state === 'missed') missed++;
      else if (state === 'skipped') skipped++;
    }
    const planned = done + missed;
    if (planned > 0) standings.push({ trackerId: tracker.id, done, planned, skipped, share: done / planned });
  }
  // `sort` is stable, so equal standings keep the user's order.
  return standings.sort((a, b) => b.share - a.share || b.planned - a.planned);
}
