import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ensureCurrentDay } from './ensureCurrentDay';
import { msUntilNextAppDay } from '../utils/dayRollover';

const ROLLOVER_RETRY_MS = 5_000;

/** Reload habits and counters when the app calendar day changes or the app returns active. */
export function useDayRolloverRefresh(): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearRetry = () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const handlePotentialRollover = async () => {
      try {
        await ensureCurrentDay();
        clearRetry();
      } catch (error) {
        console.warn('Day rollover refresh failed; scheduling retry', error);
        clearRetry();
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          void handlePotentialRollover();
        }, ROLLOVER_RETRY_MS);
      }
    };

    const scheduleNextDayRefresh = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        void handlePotentialRollover().finally(() => {
          scheduleNextDayRefresh();
        });
      }, msUntilNextAppDay());
    };

    scheduleNextDayRefresh();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void handlePotentialRollover();
      }
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearRetry();
      subscription.remove();
    };
  }, []);
}
