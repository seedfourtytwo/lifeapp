import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveHabits } from '../utils/dashboardElements';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useElementStore } from '../store/elementStore';

/** Active habits as streak/day-state query inputs — stable while the active set is unchanged. */
function useActiveHabitInputs() {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);

  return useMemo(() => {
    const habits = getActiveHabits(elements, dashboard);
    return habitStreakInputsFromElements(habits);
  }, [elements, dashboard]);
}

/** Refresh today's completion and streaks when Home gains focus. */
export function useRefreshHabitDayOnFocus(): void {
  const inputs = useActiveHabitInputs();
  const loadHabitDayState = useEventStore((s) => s.loadHabitDayState);
  const loadHabitStreaks = useEventStore((s) => s.loadHabitStreaks);

  useFocusEffect(
    useCallback(() => {
      if (inputs.length === 0) return;
      // Day state alone is not enough — streaks must refresh so incomplete
      // habits still show the run they're protecting (through yesterday).
      void Promise.all([loadHabitDayState(inputs), loadHabitStreaks(inputs)]);
    }, [inputs, loadHabitDayState, loadHabitStreaks]),
  );
}

