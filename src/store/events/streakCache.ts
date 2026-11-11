import { loadCounterStreakMaps } from '../counterStreakFetch';
import { loadHabitStreakMaps } from '../habitStreakFetch';
import { inMirrorOrder } from './dayMirror';
import type { EventState, GetEventState, SetEventState } from './state';

type StreakCacheActions = Pick<EventState, 'loadCounterStreaks' | 'loadHabitStreaks'>;

/** Streaks per tracker, read through the same ordered queue as the day mirror. */
export function createStreakCacheActions(set: SetEventState, get: GetEventState): StreakCacheActions {
  return {
    loadCounterStreaks: (counters) =>
      inMirrorOrder(async () => {
        if (counters.length === 0) return;
        const streaks = await loadCounterStreakMaps(counters);
        set({ counterStreaks: { ...get().counterStreaks, ...streaks } });
      }),

    loadHabitStreaks: (habits) =>
      inMirrorOrder(async () => {
        if (habits.length === 0) return;
        const { streaks, failureStreaks } = await loadHabitStreakMaps(habits);
        set({
          habitStreaks: { ...get().habitStreaks, ...streaks },
          habitFailureStreaks: { ...get().habitFailureStreaks, ...failureStreaks },
        });
      }),
  };
}
