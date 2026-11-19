/**
 * The strength series behind the 90-day line: the score after each day of the
 * same walk `computeStrengthScore` does, whose last point is that score.
 */
import { shiftDateString, trackerDayHistory, type HabitSchedule } from '../src/protocol';
import { reviewStrengthSeries, type ReviewTrackerData } from '../src/review';
import { computeStrengthScore, computeStrengthSeries } from '../src/utils/strengthScore';
import { evaluateTrackerToday } from '../src/utils/trackerDayRules';

const history = (completed: string[], skipped: string[] = []) =>
  trackerDayHistory([
    ...completed.map((date) => ({ date, complete: true, hasSkipRow: false })),
    ...skipped.map((date) => ({ date, complete: false, hasSkipRow: true })),
  ]);
const daily: HabitSchedule = { type: 'daily' };
const TODAY = '2026-11-18';

describe('computeStrengthSeries', () => {
  it('has one point per walked day, from creation through today', () => {
    const series = computeStrengthSeries({
      schedule: daily,
      history: history(['2026-11-16', '2026-11-17']),
      today: TODAY,
      createdOn: '2026-11-15',
    });
    expect(series.map((point) => point.date)).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
    expect(series[0].score).toBe(0);
    expect(series[1].score).toBeGreaterThan(0);
    expect(series[2].score).toBeGreaterThan(series[1].score);
  });

  it('carries the score over a skipped day and leaves an open today out', () => {
    const series = computeStrengthSeries({
      schedule: daily,
      history: history(['2026-11-15', '2026-11-16'], ['2026-11-17']),
      today: TODAY,
      createdOn: '2026-11-15',
    });
    const [, mon, tue, wed] = series.map((point) => point.score);
    expect(tue).toBe(mon);
    expect(wed).toBe(tue);
  });

  it('is empty when the tracker starts after today', () => {
    expect(
      computeStrengthSeries({ schedule: daily, history: history([]), today: TODAY, createdOn: '2026-11-19' }),
    ).toEqual([]);
  });

  it('ends on exactly the score computeStrengthScore reports', () => {
    const completed: string[] = [];
    for (let i = 0; i < 300; i += 1) {
      if (i % 3 !== 0) completed.push(shiftDateString(TODAY, -i));
    }
    const schedules: HabitSchedule[] = [
      daily,
      { type: 'weekdays', days: [1, 3, 5] },
      { type: 'every_n_days', interval: 2, anchorDate: '2025-01-01' },
      { type: 'times_per_week', times: 3 },
    ];
    for (const schedule of schedules) {
      const input = { schedule, history: history(completed, [shiftDateString(TODAY, -4)]), today: TODAY };
      const series = computeStrengthSeries(input);
      expect(series).toHaveLength(400);
      expect(series[series.length - 1].score).toBe(computeStrengthScore(input));
    }
  });
});

describe('reviewStrengthSeries', () => {
  const days = [
    { date: '2026-11-15', total: 12 },
    { date: '2026-11-16', total: 3 },
    { date: '2026-11-17', total: 10, skipped: true },
  ];
  const counter = (dailyTarget?: number): ReviewTrackerData => ({
    tracker: {
      id: 'c',
      rules: { kind: 'counter', config: { unit: 'reps', quickIncrements: [1], ...(dailyTarget ? { dailyTarget } : {}) } },
      createdOn: '2026-11-01',
    },
    history: trackerDayHistory(
      days.map((d) => ({ date: d.date, complete: dailyTarget !== undefined && d.total >= dailyTarget, hasSkipRow: d.skipped === true })),
    ),
  });

  it('ends on the score Home shows for the same tracker', () => {
    const data = counter(10);
    const series = reviewStrengthSeries(data, TODAY);
    const home = evaluateTrackerToday({ tracker: data.tracker.rules, days, today: TODAY, createdOn: '2026-11-01' });
    expect(series[series.length - 1].score).toBe(home.score);
    expect(series[0].date).toBe('2026-11-01');
  });

  it('is empty for a counter without a target', () => {
    expect(reviewStrengthSeries(counter(), TODAY)).toEqual([]);
  });
});
