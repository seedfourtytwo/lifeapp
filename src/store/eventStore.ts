import { create } from 'zustand';
import { isCounterElement, isHabitElement, type ElementDefinition } from '../protocol';
import type { CounterStreakInput } from './counterStreakFetch';
import type { HabitStreakInput } from './habitStreakFetch';
import { createDayMirrorActions } from './events/dayMirror';
import { createEventCommands } from './events/eventCommands';
import { createStreakCacheActions } from './events/streakCache';
import { createTimerSessionActions } from './events/timerSessionActions';
import { todayDate, type EventState } from './events/state';

export type { HabitStreakInput, CounterStreakInput };
export { awaitElementEventWrites, awaitPendingEventWrites } from './events/eventCommands';

/**
 * Today's events as SQLite holds them, a mirror of the native core's timer,
 * and the commands that change either. The parts live in `./events/`: the day mirror, the
 * streak cache, the timer sessions and the event commands.
 */
export const useEventStore = create<EventState>((set, get) => ({
  dailyTotals: {},
  habitDoneToday: {},
  habitMarkedToday: {},
  habitStreaks: {},
  habitFailureStreaks: {},
  counterStreaks: {},
  activeTimerSessions: {},
  dayMapsDate: todayDate(),
  dayStateReady: false,
  counterTotalsReady: false,

  reset: async () => {
    // The *Ready flags go back to false with the maps: the loaders that set
    // them true are what refills these, and until they run nothing here is
    // known — a screen must wait rather than read an empty map as "zero today".
    set({
      dailyTotals: {},
      habitDoneToday: {},
      habitMarkedToday: {},
      habitStreaks: {},
      habitFailureStreaks: {},
      counterStreaks: {},
      activeTimerSessions: {},
      dayMapsDate: todayDate(),
      dayStateReady: false,
      counterTotalsReady: false,
    });
  },

  ...createTimerSessionActions(set, get),
  ...createDayMirrorActions(set, get),
  ...createStreakCacheActions(set, get),
  ...createEventCommands(set, get),
}));

export function habitStreakInputsFromElements(
  elements: readonly ElementDefinition[],
): HabitStreakInput[] {
  return elements
    .filter(isHabitElement)
    .map((e) => ({ id: e.id, config: e.config, createdAt: e.createdAt ?? null }));
}

/** Inputs for target-hit streak loads; a counter without a target has no streak. */
export function counterStreakInputsFromElements(
  elements: readonly ElementDefinition[],
): CounterStreakInput[] {
  return elements
    .filter(isCounterElement)
    .map((e) => ({ id: e.id, config: e.config, createdAt: e.createdAt ?? null }));
}
