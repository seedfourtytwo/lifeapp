import * as fs from 'node:fs';
import * as path from 'node:path';
import { applyAppLanguage } from '../src/i18n';
import {
  BUNDLED_HABIT_SOUND_CATALOG,
  CommitmentConfigSchema,
  currentOwnLine,
  dayOutcome,
  isScheduleActiveOnDate,
  lampsPassed,
  nextLamp,
  type DayFacts,
  type DayOutcomeTracker,
  type HabitConfig,
  type HabitSchedule,
} from '../src/protocol';
import { formatLampLabel, formatTimeClear } from '../src/utils/commitmentFormat';

/**
 * The rules the lock-screen widget works out by itself, held to the same
 * cases in both languages: `WidgetRuleFixturesTest.kt` reads these files too.
 */
function fixture<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../modules/life-core/fixtures', name), 'utf8'),
  ) as T;
}

type FixtureGoal =
  | { type: 'seconds'; seconds: number }
  | { type: 'play_once'; trackSeconds: number }
  | { type: 'open' };

type FixtureRule =
  | { kind: 'check_off' }
  | { kind: 'timer'; goal: FixtureGoal }
  | { kind: 'counter'; target: number | null }
  | { kind: 'commitment' };

interface DayOutcomeCase {
  name: string;
  rule: FixtureRule;
  facts: DayFacts;
  done: boolean;
  reason: string;
}

const habitBase: Pick<HabitConfig, 'timeSlot' | 'schedule' | 'reminderTimes'> = {
  timeSlot: 'anytime',
  schedule: { type: 'daily' },
  reminderTimes: [],
};

/** The config that gives the widget's view of a tracker (`kind`, timer goal, target). */
function trackerFor(rule: FixtureRule): DayOutcomeTracker {
  switch (rule.kind) {
    case 'check_off':
      return { kind: 'habit', config: { ...habitBase, trackingMode: 'boolean' } };
    case 'timer': {
      const { goal } = rule;
      if (goal.type === 'seconds') {
        return {
          kind: 'habit',
          config: { ...habitBase, trackingMode: 'timer', dailyTargetSeconds: goal.seconds },
        };
      }
      if (goal.type === 'play_once') {
        const track = BUNDLED_HABIT_SOUND_CATALOG.find(
          (item) => item.durationSeconds === goal.trackSeconds,
        );
        if (!track) throw new Error(`No bundled track lasts ${goal.trackSeconds} s`);
        return {
          kind: 'habit',
          config: {
            ...habitBase,
            trackingMode: 'timer',
            timerSound: { trackId: track.id, playbackMode: 'play_once' },
          },
        };
      }
      return { kind: 'habit', config: { ...habitBase, trackingMode: 'timer' } };
    }
    case 'counter':
      return {
        kind: 'counter',
        config: {
          unit: 'glasses',
          quickIncrements: [1],
          ...(rule.target === null ? {} : { dailyTarget: rule.target }),
        },
      };
    case 'commitment':
      return {
        kind: 'commitment',
        config: CommitmentConfigSchema.parse({ clearSince: '2026-03-07T09:30:00.000Z' }),
      };
    default: {
      const unknown: never = rule;
      throw new Error(`Unknown rule ${JSON.stringify(unknown)}`);
    }
  }
}

describe('the rules shared with the widget', () => {
  it.each(fixture<{ cases: DayOutcomeCase[] }>('day-outcome.json').cases)(
    'done rule: $name',
    ({ rule, facts, done, reason }) => {
      expect(dayOutcome(trackerFor(rule), facts)).toMatchObject({ done, reason });
    },
  );

  it.each(
    fixture<{ cases: { name: string; schedule: HabitSchedule; date: string; due: boolean }[] }>(
      'due-today.json',
    ).cases,
  )('due today: $name', ({ schedule, date, due }) => {
    expect(isScheduleActiveOnDate(schedule, date)).toBe(due);
  });

  describe('lamps', () => {
    const lamps = fixture<{
      clearSince: string;
      cases: { hoursAfter: number; lampsPassed: number; nextLampHours: number }[];
      ownLines: { lines: string[]; cases: { hoursAfter: number; shown: string }[] };
    }>('lamps.json');
    const at = (hours: number) => new Date(Date.parse(lamps.clearSince) + hours * 3_600_000);

    it.each(lamps.cases)('$hoursAfter h after clear-since', ({ hoursAfter, lampsPassed: passed, nextLampHours }) => {
      expect(lampsPassed(lamps.clearSince, at(hoursAfter))).toBe(passed);
      expect(nextLamp(lamps.clearSince, at(hoursAfter)).hours).toBe(nextLampHours);
    });

    it.each(lamps.ownLines.cases)('own line $hoursAfter h after clear-since', ({ hoursAfter, shown }) => {
      const config = { ownLines: lamps.ownLines.lines, clearSince: lamps.clearSince };
      expect(currentOwnLine(config, at(hoursAfter))).toBe(shown);
    });
  });

  describe('time clear and lamp labels', () => {
    const words = fixture<{
      clearTime: { elapsedMs: number; en: string; fr: string }[];
      lampLabels: { hours: number; en: string; fr: string }[];
    }>('clear-time.json');

    afterAll(async () => {
      await applyAppLanguage('en');
    });

    it.each(['en', 'fr'] as const)('in %s', async (language) => {
      await applyAppLanguage(language);
      for (const item of words.clearTime) expect(formatTimeClear(item.elapsedMs)).toBe(item[language]);
      for (const item of words.lampLabels) expect(formatLampLabel(item.hours)).toBe(item[language]);
    });
  });
});
