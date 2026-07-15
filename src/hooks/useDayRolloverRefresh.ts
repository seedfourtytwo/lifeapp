import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  refreshAllDailyData,
  resetInMemoryDailyState,
} from './refreshAllDailyData';
import {
  currentAppCalendarDate,
  hasAppCalendarDayChanged,
  msUntilNextAppDay,
} from '../utils/dayRollover';

async function refreshForNewCalendarDay(): Promise<void> {
  resetInMemoryDailyState();
  await refreshAllDailyData();
}

/** Reload habits and counters when the app calendar day changes or the app returns active. */
export function useDayRolloverRefresh(): void {
  const dateRef = useRef(currentAppCalendarDate());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handlePotentialRollover = async () => {
      if (!hasAppCalendarDayChanged(dateRef.current)) {
        return;
      }
      dateRef.current = currentAppCalendarDate();
      await refreshForNewCalendarDay();
    };

    const scheduleNextDayRefresh = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        void handlePotentialRollover();
        scheduleNextDayRefresh();
      }, msUntilNextAppDay());
    };

    scheduleNextDayRefresh();

    const interval = setInterval(() => {
      void handlePotentialRollover();
    }, 60_000);

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void handlePotentialRollover();
      }
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
}
