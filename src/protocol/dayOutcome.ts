import type { LifeEvent } from './event';
import type { CounterConfig } from './kinds/counter';
import type { HabitConfig } from './kinds/habit';
import { getBundledHabitSoundDurationSeconds } from './habitSoundCatalog';

/**
 * The one rule for "is this day done?". Pure on purpose — no translations, no
 * UI, no SQL — so the app, the repositories' SQL aggregate and a native widget
 * all answer from the same few facts about a day.
 */

/** Everything the rule needs to know about one tracker on one day. */
export interface DayFacts {
  /** SUM(value): ticks, seconds or counts. */
  total: number;
  /** A play-once track ran to its end in one of the day's sessions. */
  trackCompleted: boolean;
  /** The user pressed Done on a timed habit before its goal was reached. */
  markedComplete: boolean;
}

export type DayEvent = Pick<LifeEvent, 'value' | 'meta'>;

/** A day known only by its total: a counter's day, or a day nothing was logged on. */
export function factsFromTotal(total: number): DayFacts {
  return { total, trackCompleted: false, markedComplete: false };
}

export function dayFactsFromEvents(events: readonly DayEvent[]): DayFacts {
  let total = 0;
  let trackCompleted = false;
  let markedComplete = false;
  for (const { value, meta } of events) {
    total += value;
    if (meta?.source === 'timer_session' && meta.trackCompleted === true) trackCompleted = true;
    if (meta?.source === 'manual_complete') markedComplete = true;
  }
  return { total, trackCompleted, markedComplete };
}

/** What finishes a timed habit. */
export type HabitTimerGoal =
  | { type: 'seconds'; seconds: number }
  /** The bundled track playing to its end; its length drives the progress bar. */
  | { type: 'play_once'; trackSeconds: number }
  | { type: 'open' };

export function habitTimerGoal(config: HabitConfig): HabitTimerGoal {
  if (config.dailyTargetSeconds !== undefined && config.dailyTargetSeconds > 0) {
    return { type: 'seconds', seconds: config.dailyTargetSeconds };
  }
  const trackId = config.timerSound?.trackId?.trim();
  if (config.timerSound?.playbackMode === 'play_once' && trackId) {
    // Unknown ids are not bundled sounds: nothing would play, so nothing can finish.
    const trackSeconds = getBundledHabitSoundDurationSeconds(trackId);
    if (trackSeconds !== undefined) return { type: 'play_once', trackSeconds };
  }
  return { type: 'open' };
}

export type DayOutcomeTracker =
  | { kind: 'habit'; config: HabitConfig }
  | { kind: 'counter'; config: CounterConfig };

/**
 * Why a day is or is not done. Callers branch on `done`; the reason is for
 * the few that show it, so a new way to keep the day (a minimum version) is
 * one more member here, not a change at every caller.
 */
export type DayOutcomeReason =
  | 'checked'
  | 'not_checked'
  | 'target_met'
  | 'under_target'
  | 'track_finished'
  | 'track_not_finished'
  | 'time_logged'
  | 'nothing_logged'
  | 'marked_complete'
  | 'no_target';

export interface DayOutcome {
  total: number;
  done: boolean;
  reason: DayOutcomeReason;
  /** The amount that finishes the day, where there is one (seconds or count). */
  target?: number;
}

function habitOutcome(config: HabitConfig, facts: DayFacts): DayOutcome {
  const { total } = facts;
  let natural: DayOutcome;
  if (config.trackingMode === 'boolean') {
    natural = { total, done: total >= 1, reason: total >= 1 ? 'checked' : 'not_checked' };
  } else {
    const goal = habitTimerGoal(config);
    switch (goal.type) {
      case 'seconds': {
        const met = total >= goal.seconds;
        natural = { total, done: met, reason: met ? 'target_met' : 'under_target', target: goal.seconds };
        break;
      }
      case 'play_once':
        natural = {
          total,
          done: facts.trackCompleted,
          reason: facts.trackCompleted ? 'track_finished' : 'track_not_finished',
          target: goal.trackSeconds,
        };
        break;
      case 'open':
        natural = { total, done: total > 0, reason: total > 0 ? 'time_logged' : 'nothing_logged' };
        break;
      default: {
        const unreachable: never = goal;
        throw new Error(`Unknown timer goal ${JSON.stringify(unreachable)}`);
      }
    }
  }
  if (!natural.done && facts.markedComplete) {
    return { ...natural, done: true, reason: 'marked_complete' };
  }
  return natural;
}

function counterOutcome(config: CounterConfig, facts: DayFacts): DayOutcome {
  const { total } = facts;
  const target = config.dailyTarget;
  if (target === undefined || target <= 0) {
    return { total, done: false, reason: 'no_target' };
  }
  const met = total >= target;
  return { total, done: met, reason: met ? 'target_met' : 'under_target', target };
}

export function dayOutcome(tracker: DayOutcomeTracker, facts: DayFacts): DayOutcome {
  switch (tracker.kind) {
    case 'habit':
      return habitOutcome(tracker.config, facts);
    case 'counter':
      return counterOutcome(tracker.config, facts);
    default: {
      const unreachable: never = tracker;
      throw new Error(`Unknown tracker kind ${JSON.stringify(unreachable)}`);
    }
  }
}
