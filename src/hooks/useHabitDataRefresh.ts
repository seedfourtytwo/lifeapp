import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveHabits } from '../utils/dashboardElements';
import { refreshAllDailyData } from './refreshAllDailyData';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useElementStore } from '../store/elementStore';

/** Active habits as streak/day-state query inputs — stable while the active set is unchanged. */
export function useActiveHabitInputs() {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);

  return useMemo(() => {
    const habits = getActiveHabits(elements, dashboard);
    return habitStreakInputsFromElements(habits);
  }, [elements, dashboard]);
}

/** Refresh today's completion state when the Habits tab gains focus. */
export function useRefreshHabitDayOnFocus(): void {
  const inputs = useActiveHabitInputs();
  const loadHabitDayState = useEventStore((s) => s.loadHabitDayState);

  useFocusEffect(
    useCallback(() => {
      if (inputs.length > 0) {
        void loadHabitDayState(inputs);
      }
    }, [inputs, loadHabitDayState]),
  );
}

/** Pull-to-refresh: reload elements, today's state, and streak history. */
export async function refreshAllHabitData(): Promise<void> {
  await refreshAllDailyData();
}
