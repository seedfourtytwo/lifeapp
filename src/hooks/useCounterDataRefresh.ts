import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveCounters } from '../utils/dashboardElements';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

function useActiveCounterIds(): string[] {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);

  return useMemo(
    () => getActiveCounters(elements, dashboard).map((element) => element.id),
    [elements, dashboard],
  );
}

/** Refresh today's totals when Home gains focus. */
export function useRefreshCounterTotalsOnFocus(): void {
  const counterIds = useActiveCounterIds();
  const loadCounterTotals = useEventStore((s) => s.loadCounterTotals);

  useFocusEffect(
    useCallback(() => {
      if (counterIds.length > 0) {
        void loadCounterTotals(counterIds);
      }
    }, [counterIds, loadCounterTotals]),
  );
}

/** Pull-to-refresh: reload elements and today's counter totals (not habits/streaks). */
export async function refreshAllCounterData(): Promise<void> {
  const loadElements = useElementStore.getState().load;
  await loadElements();

  const { elements, dashboard } = useElementStore.getState();
  const counterIds = getActiveCounters(elements, dashboard).map((element) => element.id);
  if (counterIds.length > 0) {
    await useEventStore.getState().loadCounterTotals(counterIds);
  }
}
