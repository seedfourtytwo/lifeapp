import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { stopHabitSound } from '../audio/habitTimerSound';
import { parseHabitConfig } from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { refreshAllDailyData, resetInMemoryDailyState } from './refreshAllDailyData';
import {
  currentAppCalendarDate,
  hasAppCalendarDayChanged,
  msUntilNextAppDay,
} from '../utils/dayRollover';

async function finalizeTimersForPreviousDay(previousDate: string): Promise<void> {
  const sessions = useEventStore.getState().activeTimerSessions;
  const ids = Object.keys(sessions);
  if (ids.length === 0) return;

  await stopHabitSound();
  const elements = useElementStore.getState().elements;
  const stopHabitTimer = useEventStore.getState().stopHabitTimer;
  const discardHabitTimer = useEventStore.getState().discardHabitTimer;

  const failures: string[] = [];
  for (const elementId of ids) {
    const element = elements.find((item) => item.id === elementId);
    if (element?.kind === 'habit') {
      try {
        // Session.calendarDate is the persist day; previousDate is for logging/context.
        await stopHabitTimer(elementId, parseHabitConfig(element.config), previousDate);
      } catch (error) {
        console.warn('Failed to finalize timer on day rollover', error);
        failures.push(elementId);
      }
    } else {
      discardHabitTimer(elementId);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to finalize ${failures.length} timer(s) on day rollover`);
  }
}

async function refreshForNewCalendarDay(previousDate: string): Promise<void> {
  await finalizeTimersForPreviousDay(previousDate);
  resetInMemoryDailyState();
  await refreshAllDailyData();
}

const ROLLOVER_RETRY_MS = 5_000;

/** Reload habits and counters when the app calendar day changes or the app returns active. */
export function useDayRolloverRefresh(): void {
  const dateRef = useRef(currentAppCalendarDate());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const clearRetry = () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const handlePotentialRollover = async () => {
      if (!hasAppCalendarDayChanged(dateRef.current) || inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const previousDate = dateRef.current;
      try {
        await refreshForNewCalendarDay(previousDate);
        // Only advance after success so AppState active can retry a failed rollover.
        dateRef.current = currentAppCalendarDate();
        clearRetry();
      } catch (error) {
        console.warn('Day rollover refresh failed; scheduling retry', error);
        clearRetry();
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          void handlePotentialRollover();
        }, ROLLOVER_RETRY_MS);
      } finally {
        inFlightRef.current = false;
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
