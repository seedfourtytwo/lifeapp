import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { refreshFromDb } from './refreshFromDb';
import { msUntilNextAppDay } from '../utils/dayRollover';

const REFRESH_RETRY_MS = 5_000;

/**
 * Catch up with SQLite each time the app comes to the front and at the turn of
 * the app day, retrying a failed pass after a few seconds.
 */
export function useRefreshFromDb(): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearRetry = () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const handleRefresh = async () => {
      try {
        await refreshFromDb();
        clearRetry();
      } catch (error) {
        console.warn('Refresh from the database failed; scheduling retry', error);
        clearRetry();
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          void handleRefresh();
        }, REFRESH_RETRY_MS);
      }
    };

    const scheduleNextDayRefresh = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        void handleRefresh().finally(() => {
          scheduleNextDayRefresh();
        });
      }, msUntilNextAppDay());
    };

    scheduleNextDayRefresh();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void handleRefresh();
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
