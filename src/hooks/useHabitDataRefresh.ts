import { useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveHabits } from '../utils/dashboardElements';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useElementStore } from '../store/elementStore';

/**
 * Active habits as streak/day-state query inputs, plus a string identity that
 * changes only when the active set or a config changes — not on a rename, a
 * reorder, or any other edit that leaves the queries' answers alone.
 */
function useActiveHabitInputs() {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);

  return useMemo(() => {
    const inputs = habitStreakInputsFromElements(getActiveHabits(elements, dashboard));
    const key = inputs
      .map((input) => `${input.id}:${input.createdAt ?? ''}:${JSON.stringify(input.config)}`)
      .sort()
      .join('|');
    return { inputs, key };
  }, [elements, dashboard]);
}

/**
 * Refresh today's completion and streaks when Home gains focus, and when the
 * active habits or their configs change while it is focused (which is also how
 * the cold-start load happens, once elements arrive). This is the only
 * cold-start streak load; bootstrap no longer runs its own.
 */
export function useRefreshHabitDayOnFocus(): void {
  const { inputs, key } = useActiveHabitInputs();
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const loadHabitDayState = useEventStore((s) => s.loadHabitDayState);
  const loadHabitStreaks = useEventStore((s) => s.loadHabitStreaks);

  useFocusEffect(
    useCallback(() => {
      const current = inputsRef.current;
      if (current.length === 0) return;
      // Day state alone is not enough — streaks must refresh so incomplete
      // habits still show the run they're protecting (through yesterday).
      void Promise.all([loadHabitDayState(current), loadHabitStreaks(current)]);
      // `key` stands in for `inputs`: same habits and configs, same queries.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, loadHabitDayState, loadHabitStreaks]),
  );
}
