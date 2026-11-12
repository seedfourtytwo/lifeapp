import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useUrgeStore } from '../store/urgeStore';
import { refreshFromDb } from './refreshFromDb';
import { whenStartupDone } from './startupGate';
import { msUntilNextAppDay } from '../utils/dayRollover';

const REFRESH_RETRY_MS = 5_000;

/**
 * Catch up with SQLite (the widget's queue drained first), then open the
 * urge's ride if one is running: an urge tapped on the lock screen lands on
 * its ride as the app opens.
 */
export async function openRideIfRunning(openRide: () => void): Promise<void> {
  await refreshFromDb();
  if (useUrgeStore.getState().ride) openRide();
}

/**
 * Catch up with SQLite each time the app comes to the front and at the turn of
 * the app day, retrying a failed pass after a few seconds. Once start-up is
 * done and on each return to the front, a running ride is opened with
 * `openRide`.
 */
export function useRefreshFromDb(openRide: () => void): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRideRef = useRef(openRide);
  openRideRef.current = openRide;

  useEffect(() => {
    let unmounted = false;

    const clearRetry = () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const handleRefresh = async (pass: () => Promise<void> = refreshFromDb) => {
      try {
        await pass();
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

    const returnToRide = () =>
      handleRefresh(() =>
        openRideIfRunning(() => {
          if (!unmounted) openRideRef.current();
        }),
      );

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
    void whenStartupDone().then(() => {
      if (!unmounted) void returnToRide();
    });

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void returnToRide();
      }
    });

    return () => {
      unmounted = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearRetry();
      subscription.remove();
    };
  }, []);
}
