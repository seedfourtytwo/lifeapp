import type { CounterConfig, HabitConfig, LifeEvent } from '../src/protocol';

// The rule must stay loadable from places with no translations or UI (a SQL-only
// widget mirror, a headless task), so pulling in i18n here is a failure.
jest.mock('../src/i18n', () => {
  throw new Error('dayOutcome must not load i18n');
});

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { dayFactsFromEvents, dayOutcome, habitTimerGoal } =
  require('../src/protocol/dayOutcome') as typeof import('../src/protocol/dayOutcome');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

const base: Pick<HabitConfig, 'timeSlot' | 'schedule' | 'reminderTimes'> = {
  timeSlot: 'anytime',
  schedule: { type: 'daily' },
  reminderTimes: [],
};
const checkOff: HabitConfig = { ...base, trackingMode: 'boolean' };
const secondsTimer: HabitConfig = { ...base, trackingMode: 'timer', dailyTargetSeconds: 900 };
const playOnce: HabitConfig = {
  ...base,
  trackingMode: 'timer',
  timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
};
const openEnded: HabitConfig = { ...base, trackingMode: 'timer' };
const counterWithTarget: CounterConfig = { unit: 'glasses', quickIncrements: [1], dailyTarget: 8 };
const counterNoTarget: CounterConfig = { unit: 'glasses', quickIncrements: [1] };

const habit = (config: HabitConfig) => ({ kind: 'habit' as const, config });
const counter = (config: CounterConfig) => ({ kind: 'counter' as const, config });
const facts = (total: number, extra: { trackCompleted?: boolean; markedComplete?: boolean } = {}) => ({
  total,
  trackCompleted: extra.trackCompleted ?? false,
  markedComplete: extra.markedComplete ?? false,
});

function timerSession(seconds: number, trackCompleted?: boolean): Pick<LifeEvent, 'value' | 'meta'> {
  return {
    value: seconds,
    meta: {
      source: 'timer_session',
      startedAt: '2026-03-10T08:00:00.000Z',
      endedAt: '2026-03-10T08:15:00.000Z',
      durationSeconds: seconds,
      ...(trackCompleted ? { trackCompleted: true } : {}),
    },
  };
}

describe('habitTimerGoal', () => {
  it('is a seconds target when the habit has one, even with a play-once track', () => {
    expect(habitTimerGoal(secondsTimer)).toEqual({ type: 'seconds', seconds: 900 });
    expect(habitTimerGoal({ ...playOnce, dailyTargetSeconds: 600 })).toEqual({
      type: 'seconds',
      seconds: 600,
    });
  });

  it('is the track when a play-once sound has no seconds target', () => {
    expect(habitTimerGoal(playOnce)).toEqual({ type: 'play_once', trackSeconds: 915 });
  });

  it('is open-ended for a looping track, an unknown track or no sound', () => {
    expect(habitTimerGoal(openEnded)).toEqual({ type: 'open' });
    expect(
      habitTimerGoal({ ...openEnded, timerSound: { trackId: 'meditation15min', playbackMode: 'loop' } }),
    ).toEqual({ type: 'open' });
    expect(
      habitTimerGoal({ ...openEnded, timerSound: { trackId: 'gone', playbackMode: 'play_once' } }),
    ).toEqual({ type: 'open' });
  });
});

describe('dayFactsFromEvents', () => {
  it('describes an empty day as nothing done', () => {
    expect(dayFactsFromEvents([])).toEqual(facts(0));
  });

  it('sums values and notices a finished track and a manual Done', () => {
    expect(
      dayFactsFromEvents([
        timerSession(300),
        timerSession(615, true),
        { value: 0, meta: { source: 'manual_complete' } },
      ]),
    ).toEqual(facts(915, { trackCompleted: true, markedComplete: true }));
  });

  it('ignores trackCompleted on anything but a timer session', () => {
    expect(dayFactsFromEvents([{ value: 1, meta: { source: 'habit_tick', trackCompleted: true } }])).toEqual(
      facts(1),
    );
  });
});

describe('dayOutcome for habits', () => {
  it('check-off: done once ticked', () => {
    expect(dayOutcome(habit(checkOff), facts(1))).toEqual({ total: 1, done: true, reason: 'checked' });
    expect(dayOutcome(habit(checkOff), facts(0))).toEqual({
      total: 0,
      done: false,
      reason: 'not_checked',
    });
  });

  it('seconds target: done exactly at the target, not a second before', () => {
    expect(dayOutcome(habit(secondsTimer), facts(899))).toEqual({
      total: 899,
      done: false,
      reason: 'under_target',
      target: 900,
    });
    expect(dayOutcome(habit(secondsTimer), facts(900))).toEqual({
      total: 900,
      done: true,
      reason: 'target_met',
      target: 900,
    });
    expect(dayOutcome(habit(secondsTimer), facts(901)).done).toBe(true);
  });

  it('play-once: only a finished track counts, however long the session', () => {
    expect(dayOutcome(habit(playOnce), facts(1340))).toEqual({
      total: 1340,
      done: false,
      reason: 'track_not_finished',
      target: 915,
    });
    expect(dayOutcome(habit(playOnce), facts(30, { trackCompleted: true }))).toEqual({
      total: 30,
      done: true,
      reason: 'track_finished',
      target: 915,
    });
  });

  it('open-ended: any logged time is done', () => {
    expect(dayOutcome(habit(openEnded), facts(1))).toEqual({
      total: 1,
      done: true,
      reason: 'time_logged',
    });
    expect(dayOutcome(habit(openEnded), facts(0))).toEqual({
      total: 0,
      done: false,
      reason: 'nothing_logged',
    });
  });

  it('an empty day is not done for any habit', () => {
    for (const config of [checkOff, secondsTimer, playOnce, openEnded]) {
      expect(dayOutcome(habit(config), dayFactsFromEvents([])).done).toBe(false);
    }
  });

  it('a manual Done makes any habit done, whatever was logged', () => {
    for (const [config, total] of [
      [checkOff, 0],
      [secondsTimer, 459],
      [playOnce, 459],
      [openEnded, 0],
    ] as const) {
      const outcome = dayOutcome(habit(config), facts(total, { markedComplete: true }));
      expect(outcome.done).toBe(true);
      expect(outcome.reason).toBe('marked_complete');
    }
  });

  it('reaching the target on its own wins over the manual Done as the reason', () => {
    expect(dayOutcome(habit(secondsTimer), facts(900, { markedComplete: true })).reason).toBe(
      'target_met',
    );
  });
});

describe('dayOutcome for counters', () => {
  it('with a target: done at the target, not one below', () => {
    expect(dayOutcome(counter(counterWithTarget), facts(7))).toEqual({
      total: 7,
      done: false,
      reason: 'under_target',
      target: 8,
    });
    expect(dayOutcome(counter(counterWithTarget), facts(8))).toEqual({
      total: 8,
      done: true,
      reason: 'target_met',
      target: 8,
    });
  });

  it('without a target: never done, however much is logged', () => {
    expect(dayOutcome(counter(counterNoTarget), facts(12))).toEqual({
      total: 12,
      done: false,
      reason: 'no_target',
    });
  });
});
