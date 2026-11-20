/**
 * Review day states: what one cell of a tracker's strip means. Completion,
 * skips and "scheduled" come from the day rules; these pin how Review reads them.
 */
import {
  shiftDateString,
  trackerDayHistory,
  type CounterConfig,
  type HabitSchedule,
} from '../src/protocol';
import { reviewDayStates, type ReviewTracker } from '../src/review';

const TODAY = '2026-11-18'; // a Wednesday; its week runs 11-16 … 11-22

const history = (completed: string[], skipped: string[] = []) =>
  trackerDayHistory([
    ...completed.map((date) => ({ date, complete: true, hasSkipRow: false })),
    ...skipped.map((date) => ({ date, complete: false, hasSkipRow: true })),
  ]);
const range = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDateString(d, 1)) out.push(d);
  return out;
};
const habit = (schedule: HabitSchedule, createdOn: string | null = '2026-01-01'): ReviewTracker => ({
  id: 'h',
  rules: { kind: 'habit', config: { trackingMode: 'boolean', timeSlot: 'anytime', schedule } },
  createdOn,
});
const counter = (dailyTarget?: number): ReviewTracker => {
  const config: CounterConfig = { unit: 'reps', quickIncrements: [1], ...(dailyTarget ? { dailyTarget } : {}) };
  return { id: 'c', rules: { kind: 'counter', config }, createdOn: '2026-01-01' };
};
const states = (
  tracker: ReviewTracker,
  facts: ReturnType<typeof history>,
  from: string,
  to: string,
  today = TODAY,
) => Object.fromEntries(reviewDayStates(tracker, facts, range(from, to), today).map((d) => [d.date, d.state]));

describe('daily habit', () => {
  const tracker = habit({ type: 'daily' }, '2026-11-14');

  it('reads creation day, done, skipped, missed, open today and the future', () => {
    expect(states(tracker, history(['2026-11-14', '2026-11-16'], ['2026-11-15']), '2026-11-12', '2026-11-19')).toEqual({
      '2026-11-12': 'none',
      '2026-11-13': 'none',
      '2026-11-14': 'done',
      '2026-11-15': 'skipped',
      '2026-11-16': 'done',
      '2026-11-17': 'missed',
      '2026-11-18': 'open',
      '2026-11-19': 'none',
    });
  });

  it('marks today done once it is complete', () => {
    expect(states(tracker, history([TODAY]), TODAY, TODAY)[TODAY]).toBe('done');
  });

  it('shows a skipped today as skipped, not open', () => {
    expect(states(tracker, history([], [TODAY]), TODAY, TODAY)[TODAY]).toBe('skipped');
  });

  it('keeps one state per date, in the order given', () => {
    const dates = ['2026-11-17', '2026-11-14', '2026-11-17'];
    expect(reviewDayStates(tracker, history(['2026-11-14']), dates, TODAY)).toEqual([
      { date: '2026-11-17', state: 'missed' },
      { date: '2026-11-14', state: 'done' },
      { date: '2026-11-17', state: 'missed' },
    ]);
  });

  it('treats a tracker with no creation date as existing all along', () => {
    expect(states(habit({ type: 'daily' }, null), history([]), '2020-01-01', '2020-01-01')['2020-01-01']).toBe(
      'missed',
    );
  });
});

describe('weekday and every-N-days habits', () => {
  it('leaves unscheduled weekdays empty', () => {
    const tracker = habit({ type: 'weekdays', days: [1, 3, 5] });
    expect(states(tracker, history([]), '2026-11-15', '2026-11-18')).toEqual({
      '2026-11-15': 'none', // Sunday
      '2026-11-16': 'missed', // Monday
      '2026-11-17': 'none', // Tuesday
      '2026-11-18': 'open', // Wednesday, today
    });
  });

  it('only offers every third day from the anchor', () => {
    const tracker = habit({ type: 'every_n_days', interval: 3, anchorDate: '2026-11-10' });
    expect(states(tracker, history(['2026-11-13']), '2026-11-09', '2026-11-18')).toEqual({
      '2026-11-09': 'none',
      '2026-11-10': 'missed',
      '2026-11-11': 'none',
      '2026-11-12': 'none',
      '2026-11-13': 'done',
      '2026-11-14': 'none',
      '2026-11-15': 'none',
      '2026-11-16': 'missed',
      '2026-11-17': 'none',
      '2026-11-18': 'none',
    });
  });

  it('does not count a tick on an unscheduled day', () => {
    const tracker = habit({ type: 'weekdays', days: [1] });
    expect(states(tracker, history(['2026-11-17']), '2026-11-17', '2026-11-17')['2026-11-17']).toBe('none');
  });
});

describe('times_per_week habit', () => {
  const tracker = habit({ type: 'times_per_week', times: 3 });
  const lastWeek = (completed: string[], skipped: string[] = []) =>
    states(tracker, history(completed, skipped), '2026-11-09', '2026-11-15');

  it('misses the latest day of a week short by one', () => {
    expect(lastWeek(['2026-11-10', '2026-11-11'])).toEqual({
      '2026-11-09': 'none',
      '2026-11-10': 'done',
      '2026-11-11': 'done',
      '2026-11-12': 'none',
      '2026-11-13': 'none',
      '2026-11-14': 'none',
      '2026-11-15': 'missed',
    });
  });

  it('misses the last `times` days of a week with nothing done', () => {
    expect(lastWeek([])).toEqual({
      '2026-11-09': 'none',
      '2026-11-10': 'none',
      '2026-11-11': 'none',
      '2026-11-12': 'none',
      '2026-11-13': 'missed',
      '2026-11-14': 'missed',
      '2026-11-15': 'missed',
    });
  });

  it('passes over a done day when placing the misses', () => {
    expect(lastWeek(['2026-11-15'])).toMatchObject({
      '2026-11-13': 'missed',
      '2026-11-14': 'missed',
      '2026-11-15': 'done',
    });
  });

  it('shows a skip as skipped and places the misses before it', () => {
    expect(lastWeek(['2026-11-10'], ['2026-11-15'])).toEqual({
      '2026-11-09': 'none',
      '2026-11-10': 'done',
      '2026-11-11': 'none',
      '2026-11-12': 'none',
      '2026-11-13': 'missed',
      '2026-11-14': 'missed',
      '2026-11-15': 'skipped',
    });
  });

  it('never marks more misses than there are free days', () => {
    const week = lastWeek(['2026-11-09'], range('2026-11-10', '2026-11-14'));
    expect(Object.entries(week).filter(([, s]) => s === 'missed')).toEqual([['2026-11-15', 'missed']]);
  });

  it('marks nothing missed in a week that met its target', () => {
    const week = lastWeek(['2026-11-09', '2026-11-12', '2026-11-13']);
    expect(Object.values(week).filter((s) => s === 'missed')).toHaveLength(0);
  });

  it('never misses in the current, unfinished week', () => {
    expect(states(tracker, history(['2026-11-16']), '2026-11-16', '2026-11-22')).toEqual({
      '2026-11-16': 'done',
      '2026-11-17': 'none',
      '2026-11-18': 'open',
      '2026-11-19': 'none',
      '2026-11-20': 'none',
      '2026-11-21': 'none',
      '2026-11-22': 'none',
    });
  });

  it('treats a week ending today (Sunday) as unfinished', () => {
    const sunday = '2026-11-22';
    const week = states(tracker, history([]), '2026-11-16', sunday, sunday);
    expect(Object.values(week).filter((s) => s === 'missed')).toHaveLength(0);
    expect(week[sunday]).toBe('open');
  });

  it('leaves today empty once the week has met its target', () => {
    const met = habit({ type: 'times_per_week', times: 2 });
    expect(states(met, history(['2026-11-16', '2026-11-17']), TODAY, TODAY)[TODAY]).toBe('none');
  });

  it('never misses in the creation week, which was not a full week', () => {
    const created = habit({ type: 'times_per_week', times: 3 }, '2026-11-12');
    const week = states(created, history([]), '2026-11-09', '2026-11-15');
    expect(Object.values(week).every((s) => s === 'none')).toBe(true);
  });

  it('ignores done days before creation', () => {
    const created = habit({ type: 'times_per_week', times: 1 }, '2026-11-09');
    expect(states(created, history(['2026-11-08']), '2026-11-02', '2026-11-08')['2026-11-08']).toBe('none');
  });
});

describe('counters', () => {
  it('reads a counter with a target like a daily habit', () => {
    expect(states(counter(10), history(['2026-11-15'], ['2026-11-16']), '2026-11-15', '2026-11-18')).toEqual({
      '2026-11-15': 'done',
      '2026-11-16': 'skipped',
      '2026-11-17': 'missed',
      '2026-11-18': 'open',
    });
  });

  it('never misses, skips or opens a counter without a target', () => {
    expect(states(counter(), history(['2026-11-15'], ['2026-11-16']), '2026-11-15', '2026-11-18')).toEqual({
      '2026-11-15': 'done',
      '2026-11-16': 'none',
      '2026-11-17': 'none',
      '2026-11-18': 'none',
    });
  });
});

describe('a DST change', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(['Europe/London', 'America/New_York', 'Australia/Sydney'])(
    'gives each calendar day one cell in %s',
    (tz) => {
      process.env.TZ = tz;
      const tracker = habit({ type: 'weekdays', days: [0] }); // Sundays only
      const dates = range('2026-03-27', '2026-04-06');
      const result = reviewDayStates(tracker, history(['2026-03-29']), dates, '2026-04-06');
      expect(result.map((d) => d.date)).toEqual(dates);
      expect(result.filter((d) => d.state !== 'none')).toEqual([
        { date: '2026-03-29', state: 'done' },
        { date: '2026-04-05', state: 'missed' },
      ]);
    },
  );
});
