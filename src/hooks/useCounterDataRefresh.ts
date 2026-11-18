import { useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveCounters } from '../utils/dashboardElements';
import { useElementStore } from '../store/elementStore';
import {
  counterStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';

/**
 * Refresh today's totals and target-hit streaks when Home gains focus, and when
 * the active counters or their configs change while it is focused (the
 * cold-start load). Renames and other edits that leave the queries' answers
 * alone do not re-run it.
 */
export function useRefreshCounterTotalsOnFocus(): void {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const loadCounterTotals = useEventStore((s) => s.loadCounterTotals);
  const loadCounterStreaks = useEventStore((s) => s.loadCounterStreaks);

  const { counterIds, streakInputs, key } = useMemo(() => {
    const counters = getActiveCounters(elements, dashboard);
    const ids = counters.map((element) => element.id);
    const streaks = counterStreakInputsFromElements(counters);
    return {
      counterIds: ids,
      streakInputs: streaks,
      key: [
        [...ids].sort().join(','),
        streaks
          .map((c) => `${c.id}:${c.createdAt ?? ''}:${JSON.stringify(c.config)}`)
          .sort()
          .join('|'),
      ].join('#'),
    };
  }, [elements, dashboard]);
  const latest = useRef({ counterIds, streakInputs });
  latest.current = { counterIds, streakInputs };

  useFocusEffect(
    useCallback(() => {
      const { counterIds: ids, streakInputs: streaks } = latest.current;
      if (ids.length > 0) {
        void loadCounterTotals(ids);
      }
      if (streaks.length > 0) {
        void loadCounterStreaks(streaks);
      }
      // `key` stands in for the inputs: same counters and configs, same queries.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, loadCounterStreaks, loadCounterTotals]),
  );
}
