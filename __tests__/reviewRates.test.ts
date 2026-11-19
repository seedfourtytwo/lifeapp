/**
 * Review's headline: completion over the range, the comparison with the window
 * before, the tracker that slipped most, and the perfect case.
 */
import { shiftDateString, trackerDayHistory, type HabitSchedule } from '../src/protocol';
import {
  completionRate,
  REVIEW_RANGE_DAYS,
  reviewSummary,
  reviewWindowDates,
  type ReviewDayState,
  type ReviewTrackerData,
} from '../src/review';

const TODAY = '2026-11-18';
const daily: HabitSchedule = { type: 'daily' };

/** A daily habit done on the given days-ago offsets (0 = today), created long ago. */
const habitDoneOn = (id: string, offsets: number[], skippedOffsets: number[] = []): ReviewTrackerData => ({
  tracker: {
    id,
    rules: { kind: 'habit', config: { trackingMode: 'boolean', timeSlot: 'anytime', schedule: daily } },
    createdOn: '2025-01-01',
  },
  history: trackerDayHistory([
    ...offsets.map((o) => ({ date: shiftDateString(TODAY, -o), complete: true, hasSkipRow: false })),
    ...skippedOffsets.map((o) => ({ date: shiftDateString(TODAY, -o), complete: false, hasSkipRow: true })),
  ]),
});
const days = (from: number, to: number) => {
  const out: number[] = [];
  for (let o = from; o <= to; o++) out.push(o);
  return out;
};
const states = (...list: ReviewDayState[]) => list.map((state, i) => ({ date: `2026-11-${10 + i}`, state }));

describe('completionRate', () => {
  it('counts done over done + missed, ignoring skipped, open and none', () => {
    expect(completionRate(states('done', 'missed', 'skipped', 'open', 'none', 'done'))).toEqual({
      done: 2,
      due: 3,
      rate: 2 / 3,
    });
  });

  it('has no rate when nothing was due', () => {
    expect(completionRate(states('skipped', 'open', 'none'))).toEqual({ done: 0, due: 0, rate: null });
    expect(completionRate([])).toEqual({ done: 0, due: 0, rate: null });
  });
});

describe('reviewWindowDates', () => {
  it('ends on today, oldest first, and can step back whole windows', () => {
    expect(reviewWindowDates(TODAY, 3)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(reviewWindowDates(TODAY, 3, 1)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
  });

  it('crosses a year boundary', () => {
    const year = reviewWindowDates('2027-01-03', REVIEW_RANGE_DAYS.year);
    expect(year).toHaveLength(365);
    expect(year[0]).toBe('2026-01-04');
    expect(year).toContain('2026-12-31');
    expect(year).toContain('2027-01-01');
  });
});

describe('reviewSummary', () => {
  it('is empty for no trackers', () => {
    expect(reviewSummary({ trackers: [], range: 'week', today: TODAY })).toEqual({
      current: { done: 0, due: 0, rate: null },
      previous: { done: 0, due: 0, rate: null },
      comparison: 'none',
      slipped: null,
      perfect: false,
    });
  });

  it('pools trackers over the window and the one before; today open is not due', () => {
    // current week: days 1–6 past; done 1–5. Previous week: days 7–13, done 7–9.
    const summary = reviewSummary({
      trackers: [habitDoneOn('a', [1, 2, 3, 4, 5, 7, 8, 9])],
      range: 'week',
      today: TODAY,
    });
    expect(summary.current).toEqual({ done: 5, due: 6, rate: 5 / 6 });
    expect(summary.previous).toEqual({ done: 3, due: 7, rate: 3 / 7 });
    expect(summary.comparison).toBe('up');
    expect(summary.perfect).toBe(false);
  });

  it('leaves out counters without a target', () => {
    const counter: ReviewTrackerData = {
      tracker: { id: 'c', rules: { kind: 'counter', config: { unit: 'x', quickIncrements: [1] } }, createdOn: null },
      history: trackerDayHistory([{ date: shiftDateString(TODAY, -1), complete: true, hasSkipRow: false }]),
    };
    const summary = reviewSummary({ trackers: [counter], range: 'week', today: TODAY });
    expect(summary.current).toEqual({ done: 0, due: 0, rate: null });
    expect(summary.perfect).toBe(false);
  });

  it('is perfect when every due day was done, and not when nothing was due', () => {
    expect(reviewSummary({ trackers: [habitDoneOn('a', [0, 1, 2, 3, 4, 5, 6])], range: 'week', today: TODAY }).perfect).toBe(true);
    const allSkipped = habitDoneOn('a', [], days(0, 13));
    const summary = reviewSummary({ trackers: [allSkipped], range: 'week', today: TODAY });
    expect(summary.current).toEqual({ done: 0, due: 0, rate: null });
    expect(summary.perfect).toBe(false);
    expect(summary.comparison).toBe('none');
  });

  describe('comparison', () => {
    // Month range: 10 habits × 30 days = 300 due per window. Every habit is
    // done today (so today is due, not open); the rest is spread evenly.
    const share = (total: number, t: number) => Math.floor(total / 10) + (t < total % 10 ? 1 : 0);
    const make = (currentDone: number, previousDone: number) => {
      const trackers: ReviewTrackerData[] = [];
      for (let t = 0; t < 10; t++) {
        const c = share(currentDone, t);
        const p = share(previousDone, t);
        trackers.push(habitDoneOn(`t${t}`, [...days(0, c - 1), ...days(30, 30 + p - 1)]));
      }
      const summary = reviewSummary({ trackers, range: 'month', today: TODAY });
      expect([summary.current.due, summary.previous.due]).toEqual([300, 300]);
      return summary;
    };

    it('says up or down at exactly one percentage point', () => {
      expect(make(87, 84).comparison).toBe('up'); // 29% vs 28%
      expect(make(84, 87).comparison).toBe('down');
    });

    it('says same below one point', () => {
      expect(make(86, 84).comparison).toBe('same'); // 28.67% vs 28%
      expect(make(84, 84).comparison).toBe('same');
    });

    it('needs three due days in the window before', () => {
      // Created two days before the current week: previous window has 2 due days.
      const young = (createdAgo: number): ReviewTrackerData => ({
        ...habitDoneOn('y', days(0, 6)),
        tracker: { ...habitDoneOn('y', []).tracker, createdOn: shiftDateString(TODAY, -createdAgo) },
      });
      const two = reviewSummary({ trackers: [young(8)], range: 'week', today: TODAY });
      expect(two.previous.due).toBe(2);
      expect(two.comparison).toBe('none');
      const three = reviewSummary({ trackers: [young(9)], range: 'week', today: TODAY });
      expect(three.previous.due).toBe(3);
      expect(three.comparison).toBe('up');
    });
  });

  describe('slipped', () => {
    it('names the lowest-rate tracker with at least three due days', () => {
      const summary = reviewSummary({
        trackers: [habitDoneOn('good', days(0, 6)), habitDoneOn('bad', [1]), habitDoneOn('meh', [1, 2, 3])],
        range: 'week',
        today: TODAY,
      });
      expect(summary.slipped).toEqual({ trackerId: 'bad', done: 1, due: 6 });
    });

    it('ignores a tracker with fewer than three due days', () => {
      const fresh: ReviewTrackerData = {
        ...habitDoneOn('fresh', []),
        tracker: { ...habitDoneOn('fresh', []).tracker, createdOn: shiftDateString(TODAY, -2) },
      };
      const summary = reviewSummary({ trackers: [fresh, habitDoneOn('ok', [1, 2, 3, 4])], range: 'week', today: TODAY });
      expect(summary.slipped).toEqual({ trackerId: 'ok', done: 4, due: 6 });
    });

    it('is null when every qualifying tracker is at 80% or better', () => {
      // Month: 30 days, today done → 30 due; 24 done = exactly 80%.
      const at80 = habitDoneOn('a', days(0, 23));
      expect(reviewSummary({ trackers: [at80], range: 'month', today: TODAY }).slipped).toBeNull();
      const below = habitDoneOn('b', days(0, 22));
      expect(reviewSummary({ trackers: [at80, below], range: 'month', today: TODAY }).slipped).toEqual({
        trackerId: 'b',
        done: 23,
        due: 30,
      });
    });

    it('breaks a tie by the user order', () => {
      const summary = reviewSummary({
        trackers: [habitDoneOn('first', [1, 2]), habitDoneOn('second', [3, 4])],
        range: 'week',
        today: TODAY,
      });
      expect(summary.slipped?.trackerId).toBe('first');
    });
  });
});
