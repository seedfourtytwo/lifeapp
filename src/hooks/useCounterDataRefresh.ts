import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getPinnedElements } from '../utils/dashboardElements';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

function pinnedCounterIds(): string[] {
  const { elements, dashboard } = useElementStore.getState();
  return getPinnedElements(
    elements.filter((element) => element.kind === 'counter'),
    dashboard,
  ).map((element) => element.id);
}

function usePinnedCounterIds(): string[] {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);

  return useMemo(
    () =>
      getPinnedElements(
        elements.filter((element) => element.kind === 'counter'),
        dashboard,
      ).map((element) => element.id),
    [elements, dashboard],
  );
}

/** Refresh today's totals when the Counter tab gains focus. */
export function useRefreshCounterTotalsOnFocus(): void {
  const counterIds = usePinnedCounterIds();
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
  const loadElements = useElementStore.getState().load;
  const loadCounterTotals = useEventStore.getState().loadCounterTotals;

  await loadElements();
  const counterIds = pinnedCounterIds();
  if (counterIds.length > 0) {
    await loadCounterTotals(counterIds);
  }
}
