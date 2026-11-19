/**
 * What a row of the Review ledger says for a range: the figures under the
 * name, its year bars and the sentence a screen reader gets.
 */
import { counterRunStats } from '../src/components/history/counterRunStats';
import { yearReview } from '../src/components/history/yearReview';
import { shiftDateString, trackerDayHistory, type HabitSchedule } from '../src/protocol';
import type { ReviewTrackerData } from '../src/review';
import { formatPerDay, reviewRow, trackerScore } from '../src/screens/review/reviewRows';

/** A Wednesday. */
const TODAY = '2026-11-18';
const ago = (offset: number) => shiftDateString(TODAY, -offset);
const history = (done: number[], skipped: number[] = []) =>
  trackerDayHistory([
    ...done.map((o) => ({ date: ago(o), complete: true, hasSkipRow: false })),
    ...skipped.map((o) => ({ date: ago(o), complete: false, hasSkipRow: true })),
  ]);

const habit = (schedule: HabitSchedule, done: number[], skipped: number[] = []): ReviewTrackerData => ({
  tracker: {
    id: 'h',
    rules: { kind: 'habit', config: { trackingMode: 'boolean', timeSlot: 'anytime', schedule } },
    createdOn: '2025-01-01',
  },
  history: history(done, skipped),
});
const counter = (done: number[], dailyTarget?: number): ReviewTrackerData => ({
  tracker: {
    id: 'c',
    rules: { kind: 'counter', config: { unit: 'reps', quickIncrements: [1], dailyTarget } },
    createdOn: '2025-01-01',
  },
  history: history(done),
});

describe('reviewRow — a habit', () => {
  const data = habit({ type: 'daily' }, [1, 2, 3, 4], [5]);
  const row = reviewRow({ data, name: 'Meditate' }, 'week', TODAY, 86);

  it('tallies done over due, skipped and today-still-open left out, beside the score', () => {
    // Seven days: today open, four done, one skipped, one missed.
    expect(row.caption).toEqual({ kind: 'score', tally: '4/5', score: '86' });
    expect(row.days.map((day) => day.state)).toEqual([
      'missed',
      'skipped',
      'done',
      'done',
      'done',
      'done',
      'open',
    ]);
    expect(row.bars).toBeNull();
  });

  it('speaks the row as one sentence', () => {
    expect(row.spoken).toEqual({
      key: 'spoken.days',
      params: { name: 'Meditate', done: 4, count: 5, missed: 1, skipped: 1 },
    });
  });

  it('speaks a times-a-week habit in sessions', () => {
    const weekly = reviewRow(
      { data: habit({ type: 'times_per_week', times: 3 }, [8, 9, 15]), name: 'Run' },
      'month',
      TODAY,
      40,
    );
    expect(weekly.spoken.key).toBe('spoken.sessions');
  });

  it('has no tally when nothing was scheduled, rather than 0/0', () => {
    const fresh: ReviewTrackerData = {
      tracker: { ...data.tracker, createdOn: TODAY },
      history: history([]),
    };
    const empty = reviewRow({ data: fresh, name: 'New' }, 'week', TODAY, 0);
    expect(empty.caption).toEqual({ kind: 'score', tally: null, score: '0' });
    expect(empty.spoken).toEqual({ key: 'spoken.nothingDue', params: { name: 'New' } });
  });

  it('has no score when the tracker has none', () => {
    expect(reviewRow({ data, name: 'Meditate' }, 'week', TODAY, null).caption).toEqual({
      kind: 'score',
      tally: '4/5',
      score: null,
    });
  });

  it('keeps all 30 days of a month, whatever the grid draws', () => {
    expect(reviewRow({ data, name: 'Meditate' }, 'month', TODAY, 86).days).toHaveLength(30);
  });

  it('draws a year as one bar per week: a rate, a zero, or nothing due', () => {
    const bars = reviewRow({ data, name: 'Meditate' }, 'year', TODAY, 86).bars ?? [];
    expect(bars).toHaveLength(53);
    // This week: Monday and Tuesday done, today open.
    expect(bars[52]).toEqual({ weekStart: '2026-11-16', share: 1 });
    // Last week: Saturday and Sunday done, Friday skipped, four missed.
    expect(bars[51].share).toBeCloseTo(2 / 6);
    expect(bars[40].share).toBe(0);
  });
});

describe('reviewRow — counters', () => {
  it('treats a counter with a target like a habit', () => {
    const row = reviewRow({ data: counter([1, 2], 8), name: 'Water' }, 'week', TODAY, 58);
    expect(row.caption).toEqual({ kind: 'score', tally: '2/6', score: '58' });
  });

  it('says how much a counter without a target logs on a logged day', () => {
    const totals = new Map([
      [ago(1), 40],
      [ago(3), 51],
      [ago(40), 500],
    ]);
    const row = reviewRow({ data: counter([1, 3, 40]), name: 'Push-ups', totals }, 'week', TODAY, null);
    expect(row.caption).toEqual({ kind: 'perDay', value: '46' });
    expect(row.spoken).toEqual({ key: 'spoken.logged', params: { name: 'Push-ups', count: 2 } });
    expect(row.days.filter((day) => day.state === 'missed')).toEqual([]);
  });

  it('has no figure when nothing was logged in the range', () => {
    const row = reviewRow({ data: counter([40]), name: 'Push-ups' }, 'week', TODAY, null);
    expect(row.caption).toEqual({ kind: 'perDay', value: null });
  });

  it('sizes an untargeted counter’s year bars by days logged that week', () => {
    const bars = reviewRow({ data: counter([1, 2, 9]), name: 'Push-ups' }, 'year', TODAY, null).bars ?? [];
    expect(bars[52].share).toBeCloseTo(2 / 7);
    expect(bars[51].share).toBeCloseTo(1 / 7);
    expect(bars[50].share).toBeNull();
  });
});

describe('formatPerDay', () => {
  it('keeps one decimal only below 10', () => {
    expect(formatPerDay(4.56)).toBe('4.6');
    expect(formatPerDay(8)).toBe('8');
    expect(formatPerDay(62.7)).toBe('63');
    expect(formatPerDay(10)).toBe('10');
  });

  it('does not round up into a decimal at 10', () => {
    expect(formatPerDay(9.96)).toBe('10');
  });
});

describe('trackerScore', () => {
  it('is the last point of the strength series', () => {
    expect(trackerScore(habit({ type: 'daily' }, [0, 1, 2, 3, 4, 5]), TODAY)).toBeGreaterThan(0);
  });

  it('is null for a counter without a target', () => {
    expect(trackerScore(counter([1, 2]), TODAY)).toBeNull();
  });
});

describe('counterRunStats', () => {
  it('shows the run of target days and the best run', () => {
    expect(counterRunStats({ streak: 4, bestRun: 9 })).toEqual([
      { id: 'streak', value: '4', captionKey: 'history.statInARow', count: 4 },
      { id: 'best', value: '9', captionKey: 'history.statBestRun', count: 9 },
    ]);
  });

  it('leaves out a run of zero rather than printing it', () => {
    expect(counterRunStats({ streak: 0, bestRun: 3 }).map((stat) => stat.id)).toEqual(['best']);
    expect(counterRunStats({ streak: 0, bestRun: 0 })).toEqual([]);
  });
});

describe('yearReview', () => {
  const year = yearReview(habit({ type: 'daily' }, [1, 2, 3, 4], [5]), TODAY);

  it('lays the year out as 53 Monday-first weeks ending this week', () => {
    expect(year.columns).toHaveLength(53);
    // Mon, Tue done; Wed is today and open; the rest of the week is ahead.
    expect(year.columns[52]).toEqual({
      weekStart: '2026-11-16',
      days: ['done', 'done', 'open', null, null, null, null],
    });
    expect(year.columns[0].days.every((state) => state === 'missed')).toBe(true);
  });

  it('counts what the grid shows, for the spoken summary', () => {
    expect(year.done).toBe(4);
    expect(year.skipped).toBe(1);
    // Every drawn day but today, the four done and the skip.
    expect(year.missed).toBe(52 * 7 + 3 - 1 - 4 - 1);
  });

  it('keeps the last 90 days of strength, ending on the score now', () => {
    expect(year.strength).toHaveLength(90);
    expect(year.strength[89]).toBe(trackerScore(habit({ type: 'daily' }, [1, 2, 3, 4], [5]), TODAY));
  });

  it('has no strength line for a counter without a target', () => {
    expect(yearReview(counter([1, 2]), TODAY).strength).toEqual([]);
  });
});
