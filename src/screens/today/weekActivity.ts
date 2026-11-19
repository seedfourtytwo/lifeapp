import { shiftDateString, weekStartDateString } from '../../protocol';

/** One column of the week strip. */
export type WeekDay = {
  date: string;
  when: 'past' | 'today' | 'future';
  /** 0–1: the share of active trackers with something logged that day. */
  share: number;
};

type Input = {
  /** The app calendar date. */
  today: string;
  /** Active habits and counters. */
  trackerCount: number;
  /** Trackers with something logged, per stored date. */
  loggedByDate: ReadonlyMap<string, number>;
  /**
   * The same count for today, read live from the day's totals — the stored
   * figure is as old as the last query, and today's column has to move with
   * every tick.
   */
  loggedToday: number;
};

/**
 * This week, Monday to Sunday, as seven shares. Days still to come are empty;
 * with no trackers there is nothing to take a share of, and no week at all.
 */
export function buildWeekActivity({
  today,
  trackerCount,
  loggedByDate,
  loggedToday,
}: Input): WeekDay[] {
  if (trackerCount <= 0) return [];
  const monday = weekStartDateString(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateString(monday, index);
    const when = date < today ? 'past' : date === today ? 'today' : 'future';
    const logged = when === 'future' ? 0 : when === 'today' ? loggedToday : loggedByDate.get(date) ?? 0;
    // A tracker archived since may have been logged that day: full is full.
    return { date, when, share: Math.min(1, logged / trackerCount) };
  });
}

/** What the strip says in a sentence: days so far, and days with anything logged. */
export function weekSummary(days: readonly WeekDay[]): { elapsed: number; active: number } {
  const soFar = days.filter((day) => day.when !== 'future');
  return { elapsed: soFar.length, active: soFar.filter((day) => day.share > 0).length };
}
