/**
 * Skip a day, "N times a week" and the strength score — the pure rules and
 * every caller that had to learn them (due filter, labels, reminders, the
 * evening check-in, the editor). The end-to-end contract is in
 * dayRulesFixture.test.ts; these pin the pieces.
 */
import {
  completedDaysInWeekBefore,
  filterHabitsDueToday,
  formatScheduleDescription,
  HabitConfigSchema,
  isHabitDueToday,
  isHabitOfferedToday,
  isScheduleActiveOnDate,
  isScheduleDueOnDate,
  orderHabitsList,
  PROTOCOL_VERSION,
  trackerDayHistory,
  weekStartDateString,
  type ElementDefinition,
  type HabitConfig,
  type HabitSchedule,
} from '../src/protocol';
import { startOfWeekDate } from '../src/utils/dates';
import {
  computeWeeklyFailureStreakRun,
  computeWeeklyStreakRun,
} from '../src/utils/streak';
import {
  computeStrengthScore,
  STRENGTH_LOOKBACK_DAYS,
  strengthMultiplier,
} from '../src/utils/strengthScore';
import { computeHabitStreaksFromEvents } from '../src/utils/habitStreakCompute';
import {
  formatHabitStreakLabel,
  habitCardCaption,
} from '../src/kinds/habit/habitCardLabels';
import { counterCardCaption } from '../src/kinds/counter/counterCardLabels';
import { skipTodayBubbles } from '../src/kinds/skipTodayBubble';
import { collectStartReminderFires } from '../src/notifications/habitStartReminderTimes';
import { countUnfinishedTrackersToday } from '../src/notifications/unfinishedTrackers';
import { habitReminderSignature } from '../src/hooks/useHabitReminderSync';
import { parseTrackerEditorSave } from '../src/utils/parseTrackerEditorSave';
import { editorSessionFromHabit } from '../src/components/trackerEditor/trackerEditorSession';
import { historyStats } from '../src/components/history/historyStats';
import { CounterConfigSchema } from '../src/protocol';
import { shiftDateString } from '../src/protocol';

const weekly = (times: number): HabitSchedule => ({ type: 'times_per_week', times });
const daily: HabitSchedule = { type: 'daily' };
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

describe('Monday–Sunday weeks', () => {
  it('starts every day of a week on its Monday, across a month and a DST change', () => {
    for (const date of range('2026-11-16', '2026-11-22')) {
      expect(weekStartDateString(date)).toBe('2026-11-16');
    }
    expect(weekStartDateString('2026-11-01')).toBe('2026-10-26'); // a Sunday
    expect(weekStartDateString('2026-03-29')).toBe('2026-03-23'); // EU DST Sunday
  });

  it('is the same helper the nutrition week uses', () => {
    expect(startOfWeekDate('2026-11-18')).toBe(weekStartDateString('2026-11-18'));
  });

  it('counts only earlier days of the same week', () => {
    const done = new Set(['2026-11-15', '2026-11-16', '2026-11-18']);
    expect(completedDaysInWeekBefore('2026-11-18', done)).toBe(1);
    expect(completedDaysInWeekBefore('2026-11-16', done)).toBe(0);
  });
});

describe('times_per_week schedule', () => {
  it('validates 1–6 and describes itself', () => {
    expect(HabitConfigSchema.parse({ schedule: weekly(6) }).schedule).toEqual(weekly(6));
    expect(() => HabitConfigSchema.parse({ schedule: weekly(7) })).toThrow();
    expect(formatScheduleDescription(weekly(1))).toBe('1 time a week');
    expect(formatScheduleDescription(weekly(3))).toBe('3 times a week');
  });

  it('offers every day without history, and is due until the week is met', () => {
    expect(isScheduleActiveOnDate(weekly(2), '2026-11-18')).toBe(true);
    const done = new Set(['2026-11-16']);
    expect(isScheduleDueOnDate(weekly(2), '2026-11-18', done)).toBe(true);
    done.add('2026-11-17');
    expect(isScheduleDueOnDate(weekly(2), '2026-11-18', done)).toBe(false);
    // Today itself done keeps it listed.
    done.add('2026-11-18');
    expect(isScheduleDueOnDate(weekly(2), '2026-11-18', done)).toBe(true);
    // A new week starts over.
    expect(isScheduleDueOnDate(weekly(2), '2026-11-23', done)).toBe(true);
  });
});

describe('weekly streaks', () => {
  const base = { times: 2, weekStartOf: weekStartDateString };
  it('does not break on the unfinished current week', () => {
    const completedDates = ['2026-11-09', '2026-11-10'];
    expect(computeWeeklyStreakRun({ ...base, completedDates, today: '2026-11-18' }).count).toBe(1);
  });

  it('counts consecutive missed full weeks as the failure run', () => {
    const completedDates = ['2026-10-26', '2026-10-27'];
    const input = { ...base, completedDates, today: '2026-11-18', createdOn: '2026-10-26' };
    expect(computeWeeklyStreakRun(input).count).toBe(0);
    expect(computeWeeklyFailureStreakRun(input).count).toBe(2);
  });

  it('has no failure run once this week is met', () => {
    const input = {
      ...base,
      completedDates: ['2026-11-16', '2026-11-17'],
      today: '2026-11-18',
      createdOn: '2026-10-01',
    };
    expect(computeWeeklyFailureStreakRun(input).count).toBe(0);
  });

  it('reports truncation when the run reaches the loaded window unbroken', () => {
    const completedDates = range('2026-11-02', '2026-11-18');
    const run = computeWeeklyStreakRun({
      ...base,
      completedDates,
      today: '2026-11-18',
      windowStart: '2026-11-04',
    });
    expect(run.truncated).toBe(true);
  });
});

describe('strength score', () => {
  const today = '2026-11-18';
  it('uses Loop’s multiplier', () => {
    expect(strengthMultiplier(1)).toBeCloseTo(Math.pow(0.5, 1 / 13), 12);
    expect(strengthMultiplier(3 / 7)).toBeCloseTo(Math.pow(0.5, Math.sqrt(3 / 7) / 13), 12);
  });

  it('starts at 0 and rises with every done day', () => {
    expect(computeStrengthScore({ schedule: daily, history: history([]), today })).toBe(0);
    const one = computeStrengthScore({
      schedule: daily,
      history: history([today]),
      today,
      createdOn: today,
    });
    expect(one).toBe(Math.round((1 - strengthMultiplier(1)) * 100));
    const two = computeStrengthScore({
      schedule: daily,
      history: history(['2026-11-17', today]),
      today,
      createdOn: '2026-11-17',
    });
    expect(two).toBeGreaterThan(one);
  });

  it('an unfinished today never lowers it', () => {
    const past = history(range('2026-11-01', '2026-11-17'));
    const yesterdayScore = computeStrengthScore({
      schedule: daily,
      history: past,
      today: '2026-11-17',
      createdOn: '2026-11-01',
    });
    expect(
      computeStrengthScore({ schedule: daily, history: past, today, createdOn: '2026-11-01' }),
    ).toBe(yesterdayScore);
  });

  it('one miss costs a little, not everything', () => {
    const run = range('2026-10-01', '2026-11-17');
    const full = computeStrengthScore({
      schedule: daily,
      history: history(run),
      today: '2026-11-17',
      createdOn: '2026-10-01',
    });
    const missed = computeStrengthScore({
      schedule: daily,
      history: history(run.filter((d) => d !== '2026-11-17')),
      today: '2026-11-18',
      createdOn: '2026-10-01',
    });
    expect(missed).toBeLessThan(full);
    expect(missed).toBeGreaterThan(full - 10);
  });

  it('carries over unscheduled and skipped days', () => {
    const done = ['2026-11-16'];
    const before = computeStrengthScore({
      schedule: daily,
      history: history(done),
      today: '2026-11-16',
      createdOn: '2026-11-16',
    });
    expect(
      computeStrengthScore({
        schedule: daily,
        history: history(done, ['2026-11-17']),
        today: '2026-11-17',
        createdOn: '2026-11-16',
      }),
    ).toBe(before);
    expect(
      computeStrengthScore({
        schedule: { type: 'weekdays', days: [1] },
        history: history(done),
        today: '2026-11-22',
        createdOn: '2026-11-16',
      }),
    ).toBe(before);
  });

  it('ignores days older than the lookback', () => {
    const old = shiftDateString(today, -STRENGTH_LOOKBACK_DAYS);
    expect(computeStrengthScore({ schedule: daily, history: history([old]), today })).toBe(0);
  });

  it('ignores completions before the habit existed', () => {
    expect(
      computeStrengthScore({
        schedule: weekly(1),
        history: history(['2026-11-15']),
        today,
        createdOn: '2026-11-16',
      }),
    ).toBe(0);
  });
});

describe('play-once timer completion (meta, not totals)', () => {
  it('scores and streaks on trackCompleted rows, which the JSON fixture cannot express', () => {
    const config = HabitConfigSchema.parse({
      trackingMode: 'timer',
      timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
    });
    const event = (date: string, trackCompleted: boolean) => ({
      id: `00000000-0000-4000-8000-${date.replace(/-/g, '').padStart(12, '0')}`,
      elementId: 'h',
      timestamp: `${date}T08:00:00.000Z`,
      date,
      value: 600,
      meta: {
        source: 'timer_session',
        startedAt: `${date}T07:50:00.000Z`,
        endedAt: `${date}T08:00:00.000Z`,
        durationSeconds: 600,
        ...(trackCompleted ? { trackCompleted: true } : {}),
      },
      protocolVersion: PROTOCOL_VERSION,
    });
    const result = computeHabitStreaksFromEvents(
      [event('2026-11-16', true), event('2026-11-17', false)],
      config,
      '2026-11-18',
      '2026-11-16',
    );
    expect(result.streak).toBe(0);
    expect(result.failureStreak).toBe(1);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('due today with skips and weeks', () => {
  const now = new Date('2026-11-18T08:00:00');
  const ctx = { now, today: '2026-11-18' };
  const cfg = (schedule: HabitSchedule): HabitConfig =>
    HabitConfigSchema.parse({ schedule });
  const habit = (id: string, schedule: HabitSchedule): ElementDefinition => ({
    id,
    kind: 'habit',
    name: id,
    config: { schedule },
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  it('a skipped habit is offered but not due; a done one is still due', () => {
    expect(isHabitOfferedToday(cfg(daily), ctx, { skipRow: true })).toBe(true);
    expect(isHabitDueToday(cfg(daily), ctx, { skipRow: true })).toBe(false);
    expect(isHabitDueToday(cfg(daily), ctx, { skipRow: true, doneToday: true })).toBe(true);
  });

  it('Home keeps skipped rows and sinks them; the lock screen leaves them out', () => {
    const habits = [habit('a', daily), habit('b', daily), habit('w', weekly(2))];
    const context = {
      ...ctx,
      habitDoneToday: {},
      skipRowToday: { a: true },
      habitWeekDoneBefore: { w: ['2026-11-16', '2026-11-17'] },
    };
    expect(filterHabitsDueToday(habits, context).map((h) => h.id)).toEqual(['b']);
    const home = filterHabitsDueToday(habits, { ...context, includeSkipped: true });
    expect(home.map((h) => h.id)).toEqual(['a', 'b']);
    expect(orderHabitsList(home, {}, { a: true }).map((h) => h.id)).toEqual(['b', 'a']);
  });
});

describe('Home captions', () => {
  const dailyCfg = HabitConfigSchema.parse({});
  const weeklyCfg = HabitConfigSchema.parse({ schedule: weekly(3) });
  const counterCfg = CounterConfigSchema.parse({
    unit: 'reps',
    quickIncrements: [10],
    dailyTarget: 50,
  });

  it('a times-a-week streak says weeks', () => {
    expect(formatHabitStreakLabel(weeklyCfg, 1)).toBe('1 week in a row');
    expect(formatHabitStreakLabel(weeklyCfg, 4)).toBe('4 weeks in a row');
  });

  it('shows strength, not a count of misses, once the run is broken', () => {
    expect(habitCardCaption(dailyCfg, { streak: 0, score: 62 })).toEqual({
      text: 'Strength',
      figure: '62',
      a11y: 'Strength 62 out of 100',
    });
    expect(habitCardCaption(dailyCfg, { streak: 3, score: 62 })?.text).toBe('3 days in a row');
    expect(habitCardCaption(dailyCfg, { streak: 0, score: 0 })).toBeNull();
    const hidden = HabitConfigSchema.parse({ showStreakOnCard: false });
    expect(habitCardCaption(hidden, { streak: 0, score: 62 })).toBeNull();
    expect(counterCardCaption(counterCfg, { streak: 0, score: 40 })?.figure).toBe('40');
  });

  it('says skipped in words, ahead of anything else', () => {
    expect(habitCardCaption(dailyCfg, { streak: 5, skipped: true })?.text).toBe('Skipped today');
    expect(counterCardCaption(counterCfg, { streak: 5, skipped: true })?.text).toBe(
      'Skipped today',
    );
  });

  it('offers Skip, or Undo skip, but never on a complete day', () => {
    const onSkipToday = jest.fn();
    const [skipBubble] = skipTodayBubbles({ complete: false, skipped: false, onSkipToday });
    skipBubble!.onPress();
    expect(onSkipToday).toHaveBeenCalledWith(true);
    const [undo] = skipTodayBubbles({ complete: false, skipped: true, onSkipToday });
    expect(undo!.accessibilityLabel).toBe('Undo skip');
    expect(skipTodayBubbles({ complete: true, skipped: false, onSkipToday })).toEqual([]);
  });

  it('the history stat names weeks for a weekly habit', () => {
    const stats = historyStats({
      kind: 'habit',
      daysDone: 4,
      streak: 2,
      bestRun: 0,
      streakUnit: 'weeks',
    });
    expect(stats.find((s) => s.id === 'streak')?.captionKey).toBe('history.statInARowWeeks');
  });
});

describe('reminders and the evening check-in', () => {
  const timed = (schedule: HabitSchedule): HabitConfig => ({
    trackingMode: 'boolean',
    timeSlot: 'morning',
    schedule,
    timeRange: { start: '07:00', end: '08:00' },
    remindMinutesBefore: 15,
  });
  // Wednesday 2026-11-18, 06:00 — today's 06:45 reminder is still ahead.
  const now = new Date(2026, 10, 18, 6, 0, 0);

  it('drops today’s reminder when skipped', () => {
    const fires = collectStartReminderFires(timed(daily), {
      now,
      doneToday: false,
      skippedToday: true,
      horizonDays: 2,
    });
    expect(fires.map((f) => f.dateStr)).toEqual(['2026-11-19']);
  });

  it('times a week: reminds while still due, none once the week is met', () => {
    const open = collectStartReminderFires(timed(weekly(2)), {
      now,
      doneToday: false,
      weekDoneBefore: ['2026-11-16'],
      horizonDays: 7,
    });
    expect(open).toHaveLength(7);
    const met = collectStartReminderFires(timed(weekly(2)), {
      now,
      doneToday: false,
      weekDoneBefore: ['2026-11-16', '2026-11-17'],
      horizonDays: 7,
    });
    // The rest of this week (Wed–Sun) is no longer due; next week is.
    expect(met.map((f) => f.dateStr)).toEqual(['2026-11-23', '2026-11-24']);
  });

  it('a skip or a weekly done day changes the reminder signature', () => {
    const element: ElementDefinition = {
      id: 'h1',
      kind: 'habit',
      name: 'Run',
      config: timed(weekly(2)),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const base = habitReminderSignature([element], {}, '2026-11-18', 'en');
    expect(
      habitReminderSignature([element], {}, '2026-11-18', 'en', { skipRowToday: { h1: true } }),
    ).not.toBe(base);
    expect(
      habitReminderSignature([element], {}, '2026-11-18', 'en', {
        habitWeekDoneBefore: { h1: ['2026-11-16'] },
      }),
    ).not.toBe(base);
  });

  it('the check-in does not count skipped habits or counters', () => {
    const elements: ElementDefinition[] = [
      {
        id: 'h1',
        kind: 'habit',
        name: 'Read',
        config: { schedule: daily },
        protocolVersion: PROTOCOL_VERSION,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'c1',
        kind: 'counter',
        name: 'Push-ups',
        config: { unit: 'reps', quickIncrements: [10], dailyTarget: 50 },
        protocolVersion: PROTOCOL_VERSION,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const args = { elements, habitDoneToday: {}, dailyTotals: { c1: 10 }, now };
    expect(countUnfinishedTrackersToday(args).total).toBe(2);
    expect(
      countUnfinishedTrackersToday({ ...args, skipRowToday: { h1: true, c1: true } }).total,
    ).toBe(0);
  });
});

describe('editor', () => {
  it('saves and reloads a times-a-week schedule', () => {
    const session = editorSessionFromHabit(
      'id',
      'Run',
      HabitConfigSchema.parse({ schedule: weekly(4) }),
    );
    expect(session.scheduleType).toBe('times_per_week');
    expect(session.scheduleTimesPerWeek).toBe('4');
    const saved = parseTrackerEditorSave({
      mode: 'habit',
      name: session.name,
      icon: null,
      targetLabel: '',
      habitTrackingMode: 'boolean',
      habitDailyGoalMinutes: '',
      habitSoundTrackId: '',
      habitSoundPlaybackMode: 'play_once',
      useTimeRange: false,
      timeRangeStart: '',
      timeRangeEnd: '',
      visibleOnlyInTimeRange: false,
      scheduleType: 'times_per_week',
      scheduleWeekdays: [],
      scheduleInterval: '2',
      scheduleAnchorDate: '2026-11-18',
      scheduleTimesPerWeek: '4',
      useReminder: false,
      remindMinutesBefore: '15',
      showStreakOnCard: true,
    });
    expect(saved).toMatchObject({ kind: 'habit', input: { schedule: weekly(4) } });
  });
});
