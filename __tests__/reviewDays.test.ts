/**
 * Review's day-level figures: what one day's square shows, the three facts
 * over the heat map, and the ranking under it.
 */
import { shiftDateString, trackerDayHistory, type HabitSchedule } from '../src/protocol';
import {
  bestWeekday,
  dayCounts,
  dayTallies,
  fullDayRun,
  heatLevel,
  isFullDay,
  trackerStandings,
  type DayTally,
  type ReviewTrackerData,
} from '../src/review';

/** A Wednesday. */
const TODAY = '2026-11-18';
const ago = (offset: number) => shiftDateString(TODAY, -offset);
const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let o = from; o <= to; o++) out.push(o);
  return out;
};

/** A habit done / skipped on the given days-ago offsets (0 = today). */
function habit(
  id: string,
  doneOffsets: number[],
  options: { skipped?: number[]; createdAgo?: number; schedule?: HabitSchedule } = {},
): ReviewTrackerData {
  return {
    tracker: {
      id,
      rules: {
        kind: 'habit',
        config: { trackingMode: 'boolean', timeSlot: 'anytime', schedule: options.schedule ?? { type: 'daily' } },
      },
      createdOn: options.createdAgo === undefined ? '2025-01-01' : ago(options.createdAgo),
    },
    history: trackerDayHistory([
      ...doneOffsets.map((o) => ({ date: ago(o), complete: true, hasSkipRow: false })),
      ...(options.skipped ?? []).map((o) => ({ date: ago(o), complete: false, hasSkipRow: true })),
    ]),
  };
}

const untargetedCounter: ReviewTrackerData = {
  tracker: { id: 'c', rules: { kind: 'counter', config: { unit: 'x', quickIncrements: [1] } }, createdOn: null },
  history: trackerDayHistory([{ date: ago(1), complete: true, hasSkipRow: false }]),
};

const tally = (date: string, done: number, planned: number, open = 0): DayTally => ({ date, done, planned, open });
/** Tallies for the days ending today, oldest first, from `[done, planned]` pairs. */
const endingToday = (...pairs: [number, number, number?][]): DayTally[] =>
  pairs.map(([done, planned, open], index) => tally(ago(pairs.length - 1 - index), done, planned, open ?? 0));

describe('dayTallies', () => {
  const dates = [ago(2), ago(1), ago(0), shiftDateString(TODAY, 1)];

  it('has nothing planned on any day without trackers', () => {
    expect(dayTallies([], dates, TODAY)).toEqual(dates.map((date) => tally(date, 0, 0)));
  });

  it('counts done over done + missed, and today’s unfinished items as planned but open', () => {
    const tallies = dayTallies([habit('a', [0, 1, 2]), habit('b', [2]), habit('c', [])], dates, TODAY);
    expect(tallies).toEqual([
      tally(ago(2), 2, 3),
      tally(ago(1), 1, 3),
      tally(TODAY, 1, 3, 2),
      // A day that has not come yet plans nothing.
      tally(shiftDateString(TODAY, 1), 0, 0),
    ]);
  });

  it('leaves a skipped day out of what was planned', () => {
    const tallies = dayTallies([habit('a', [1]), habit('b', [], { skipped: [1, 2] })], [ago(2), ago(1)], TODAY);
    expect(tallies).toEqual([tally(ago(2), 0, 1), tally(ago(1), 1, 1)]);
  });

  it('plans nothing on a day where everything was skipped', () => {
    expect(dayTallies([habit('a', [], { skipped: [1] })], [ago(1)], TODAY)).toEqual([tally(ago(1), 0, 0)]);
  });

  it('plans nothing for a tracker before it existed', () => {
    const fresh = habit('new', [0], { createdAgo: 0 });
    expect(dayTallies([fresh], [ago(1), TODAY], TODAY)).toEqual([tally(ago(1), 0, 0), tally(TODAY, 1, 1)]);
  });

  it('leaves out a counter without a target, which cannot miss a day', () => {
    expect(dayTallies([untargetedCounter], [ago(1)], TODAY)).toEqual([tally(ago(1), 0, 0)]);
  });
});

describe('heatLevel', () => {
  it.each([
    [0, 0, 0],
    [0, 5, 0],
    [1, 100, 1],
    [1, 3, 1],
    [33, 100, 1],
    [34, 100, 2],
    [2, 3, 2],
    [66, 100, 2],
    [67, 100, 3],
    [99, 100, 3],
    [3, 3, 4],
  ])('%i of %i planned is level %i', (done, planned, level) => {
    expect(heatLevel(tally(TODAY, done, planned))).toBe(level);
  });
});

describe('full days', () => {
  it('needs something planned and all of it done', () => {
    expect(isFullDay(tally(TODAY, 3, 3))).toBe(true);
    expect(isFullDay(tally(TODAY, 2, 3))).toBe(false);
    expect(isFullDay(tally(TODAY, 0, 0))).toBe(false);
  });

  it('counts full, partly done and empty days, leaving out days with nothing planned', () => {
    expect(dayCounts(endingToday([3, 3], [1, 3], [0, 3], [0, 0], [2, 2]))).toEqual({ full: 2, partial: 1, empty: 1 });
  });

  it('does not call today empty while it is still open', () => {
    expect(dayCounts(endingToday([0, 3, 3]))).toEqual({ full: 0, partial: 0, empty: 0 });
    expect(dayCounts(endingToday([1, 3, 2]))).toEqual({ full: 0, partial: 1, empty: 0 });
  });
});

describe('fullDayRun', () => {
  it('is zero with no days, or when yesterday was not full', () => {
    expect(fullDayRun([], TODAY)).toBe(0);
    expect(fullDayRun(endingToday([3, 3], [1, 3], [0, 3, 3]), TODAY)).toBe(0);
  });

  it('counts back from yesterday while today is still open', () => {
    expect(fullDayRun(endingToday([1, 3], [3, 3], [2, 2], [1, 3, 2]), TODAY)).toBe(2);
  });

  it('counts today once it is full', () => {
    expect(fullDayRun(endingToday([1, 3], [3, 3], [2, 2], [3, 3]), TODAY)).toBe(3);
  });

  it('passes over a day with nothing planned without counting or breaking', () => {
    expect(fullDayRun(endingToday([2, 2], [0, 0], [1, 1], [0, 2, 2]), TODAY)).toBe(2);
  });

  it('ignores days after today', () => {
    const days = [...endingToday([2, 2], [0, 1, 1]), tally(shiftDateString(TODAY, 1), 0, 0)];
    expect(fullDayRun(days, TODAY)).toBe(1);
  });

  it('runs to the start of what it was given', () => {
    expect(fullDayRun(endingToday([1, 1], [1, 1], [1, 1]), TODAY)).toBe(3);
  });
});

describe('bestWeekday', () => {
  /** Four whole weeks ending last Sunday; `shareOf` gives each weekday's [done, planned]. */
  const weeks = (shareOf: (weekday: number, week: number) => [number, number]): DayTally[] => {
    const lastMonday = '2026-11-09';
    const out: DayTally[] = [];
    for (let week = 3; week >= 0; week--) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const [done, planned] = shareOf(weekday, week);
        out.push(tally(shiftDateString(lastMonday, weekday - 7 * week), done, planned));
      }
    }
    return out;
  };

  it('is the weekday with the highest share done, Monday being 0', () => {
    expect(bestWeekday(weeks((weekday) => (weekday === 1 ? [3, 4] : [1, 4])))).toBe(1);
    expect(bestWeekday(weeks((weekday) => (weekday === 6 ? [4, 4] : [3, 4])))).toBe(6);
  });

  it('pools a weekday over the range rather than averaging its days', () => {
    // Tuesday: 1/1 and 0/9 → 10%. Friday: 2/5 twice → 40%.
    const days = weeks((weekday, week) => {
      if (week > 1) return [0, 0];
      if (weekday === 1) return week === 0 ? [1, 1] : [0, 9];
      return weekday === 4 ? [2, 5] : [0, 0];
    });
    expect(bestWeekday(days)).toBe(4);
  });

  it('gives a tie to the earlier weekday', () => {
    expect(bestWeekday(weeks(() => [2, 4]))).toBe(0);
  });

  it('cannot say within a single week', () => {
    expect(bestWeekday(weeks((weekday, week) => (week === 0 ? [weekday, 7] : [0, 0])))).toBeNull();
  });

  it('cannot say when only one weekday had plans twice', () => {
    expect(bestWeekday(weeks((weekday) => (weekday === 2 ? [1, 1] : [0, 0])))).toBeNull();
  });

  it('cannot say when nothing was done or nothing planned', () => {
    expect(bestWeekday(weeks(() => [0, 3]))).toBeNull();
    expect(bestWeekday([])).toBeNull();
  });

  it('judges today only by what is settled', () => {
    // Wednesdays: 1/2 last week, and today 1 done with 5 still open → 2/3.
    const days = [
      ...weeks((weekday, week) => (week > 0 ? [0, 0] : weekday === 2 ? [1, 2] : weekday <= 1 ? [1, 2] : [0, 0])),
      tally('2026-11-16', 1, 2),
      tally('2026-11-17', 1, 2),
      tally(TODAY, 1, 6, 5),
    ];
    expect(bestWeekday(days)).toBe(2);
  });
});

describe('trackerStandings', () => {
  const week = range(0, 6).map(ago).reverse();

  it('is empty without trackers', () => {
    expect(trackerStandings([], week, TODAY)).toEqual([]);
  });

  it('ranks by share done, best first, with today open left out', () => {
    const standings = trackerStandings(
      [habit('low', [1]), habit('high', range(1, 6)), habit('mid', [1, 2, 3])],
      week,
      TODAY,
    );
    expect(standings).toEqual([
      { trackerId: 'high', done: 6, planned: 6, skipped: 0, share: 1 },
      { trackerId: 'mid', done: 3, planned: 6, skipped: 0, share: 0.5 },
      { trackerId: 'low', done: 1, planned: 6, skipped: 0, share: 1 / 6 },
    ]);
  });

  it('leaves skipped days out of what was planned, and says how many', () => {
    expect(trackerStandings([habit('a', [1, 2], { skipped: [3, 4] })], week, TODAY)).toEqual([
      { trackerId: 'a', done: 2, planned: 4, skipped: 2, share: 0.5 },
    ]);
  });

  it('leaves out a tracker with nothing planned in the range', () => {
    const standings = trackerStandings(
      [untargetedCounter, habit('allSkipped', [], { skipped: range(0, 6) }), habit('newToday', [], { createdAgo: 0 })],
      week,
      TODAY,
    );
    expect(standings).toEqual([]);
  });

  it('counts a brand-new tracker only from the day it was made', () => {
    expect(trackerStandings([habit('new', [0, 1], { createdAgo: 1 })], week, TODAY)).toEqual([
      { trackerId: 'new', done: 2, planned: 2, skipped: 0, share: 1 },
    ]);
  });

  it('breaks a tie by the larger plan, then by the user’s order', () => {
    const standings = trackerStandings(
      [habit('short', [0, 1], { createdAgo: 1 }), habit('first', range(0, 6)), habit('second', range(0, 6))],
      week,
      TODAY,
    );
    expect(standings.map((standing) => standing.trackerId)).toEqual(['first', 'second', 'short']);
  });
});
