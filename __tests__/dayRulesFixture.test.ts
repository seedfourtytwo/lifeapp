/**
 * The day-rules contract with the Android widget (Kotlin, same SQLite rows):
 * every case in `fixtures/dayRules.json` runs through the real functions here,
 * and the widget's own tests load the same file. The fixture is plain JSON on
 * purpose — no TS-only shapes — so both sides read it unchanged.
 *
 * Not expressible in the fixture: a play-once timer habit without a seconds
 * target. Its completion is `meta.trackCompleted` on a timer_session row, not
 * anything a daily total can say, so it is covered by habitStreakCompute tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CounterConfigSchema, HabitConfigSchema } from '../src/protocol';
import { evaluateTrackerToday, type DayRulesTracker } from '../src/utils/trackerDayRules';

type FixtureCase = {
  name: string;
  kind: 'habit' | 'counter';
  config: Record<string, unknown>;
  createdOn: string;
  today: string;
  days: Record<string, { total: number; skipped?: boolean }>;
  expect: {
    dueToday: boolean;
    doneToday: boolean;
    skippedToday: boolean;
    streak: number;
    streakUnit: 'days' | 'weeks';
    score: number;
  };
};

const cases = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/dayRules.json'), 'utf8'),
) as FixtureCase[];

function trackerFor(testCase: FixtureCase): DayRulesTracker {
  return testCase.kind === 'habit'
    ? { kind: 'habit', config: HabitConfigSchema.parse(testCase.config) }
    : { kind: 'counter', config: CounterConfigSchema.parse(testCase.config) };
}

describe('shared day-rules fixture', () => {
  it('has the cases the contract promises', () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
    const schedules = new Set(
      cases.map((c) => (c.config.schedule as { type?: string } | undefined)?.type ?? c.kind),
    );
    for (const type of ['daily', 'weekdays', 'every_n_days', 'times_per_week', 'counter']) {
      expect(schedules).toContain(type);
    }
    expect(cases.some((c) => Object.values(c.days).some((d) => d.skipped))).toBe(true);
  });

  it('stays plain JSON a Kotlin parser can read', () => {
    for (const c of cases) {
      expect(Object.keys(c.expect).sort()).toEqual(
        ['doneToday', 'dueToday', 'score', 'skippedToday', 'streak', 'streakUnit'].sort(),
      );
      for (const [date, day] of Object.entries(c.days)) {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof day.total).toBe('number');
      }
    }
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const result = evaluateTrackerToday({
      tracker: trackerFor(testCase),
      days: Object.entries(testCase.days).map(([date, day]) => ({
        date,
        total: day.total,
        skipped: day.skipped === true,
      })),
      today: testCase.today,
      createdOn: testCase.createdOn,
    });
    expect({
      dueToday: result.dueToday,
      doneToday: result.doneToday,
      skippedToday: result.skippedToday,
      streak: result.streak,
      streakUnit: result.streakUnit,
      score: result.score,
    }).toEqual(testCase.expect);
  });
});
