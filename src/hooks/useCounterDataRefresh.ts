import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveElements } from '../utils/dashboardElements';
import { refreshAllDailyData } from './refreshAllDailyData';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

function useActiveCounterIds(): string[] {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);

  return useMemo(
    () =>
      getActiveElements(
        elements.filter((element) => element.kind === 'counter'),
        dashboard,
      ).map((element) => element.id),
    [elements, dashboard],
  );
}

/** Refresh today's totals when the Counter tab gains focus. */
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

/** Pull-to-refresh: reload elements and today's counter totals. */
export async function refreshAllCounterData(): Promise<void> {
  await refreshAllDailyData();
}
