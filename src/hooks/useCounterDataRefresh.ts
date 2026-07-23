import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveCounters } from '../utils/dashboardElements';
import { useElementStore } from '../store/elementStore';
import {
  counterStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';

/** Refresh today's totals and target-hit streaks when Home gains focus. */
export function useRefreshCounterTotalsOnFocus(): void {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const loadCounterTotals = useEventStore((s) => s.loadCounterTotals);
  const loadCounterStreaks = useEventStore((s) => s.loadCounterStreaks);

  const counters = useMemo(
    () => getActiveCounters(elements, dashboard),
    [elements, dashboard],
  );
  const counterIds = useMemo(() => counters.map((element) => element.id), [counters]);
  const streakInputs = useMemo(
    () => counterStreakInputsFromElements(counters),
    [counters],
  );

  useFocusEffect(
    useCallback(() => {
      if (counterIds.length > 0) {
        void loadCounterTotals(counterIds);
      }
      if (streakInputs.length > 0) {
        void loadCounterStreaks(streakInputs);
      }
    }, [counterIds, loadCounterStreaks, loadCounterTotals, streakInputs]),
  );
}

/** Pull-to-refresh: reload elements, today's counter totals, and target streaks. */
export async function refreshAllCounterData(): Promise<void> {
  const loadElements = useElementStore.getState().load;
  await loadElements();

  const { elements, dashboard } = useElementStore.getState();
  const counters = getActiveCounters(elements, dashboard);
  const counterIds = counters.map((element) => element.id);
  const streakInputs = counterStreakInputsFromElements(counters);
  const { loadCounterTotals, loadCounterStreaks } = useEventStore.getState();
  await Promise.all([
    counterIds.length > 0 ? loadCounterTotals(counterIds) : Promise.resolve(),
    streakInputs.length > 0 ? loadCounterStreaks(streakInputs) : Promise.resolve(),
  ]);
}
