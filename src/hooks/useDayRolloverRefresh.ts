import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { stopHabitSound } from '../audio/habitTimerSound';
import { parseHabitConfig } from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import {
  refreshAllDailyData,
  resetInMemoryDailyState,
} from './refreshAllDailyData';
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

  for (const elementId of ids) {
    const element = elements.find((item) => item.id === elementId);
    if (element?.kind === 'habit') {
      try {
        await stopHabitTimer(elementId, parseHabitConfig(element.config), previousDate);
      } catch (error) {
        console.warn('Failed to finalize timer on day rollover', error);
        discardHabitTimer(elementId);
      }
    } else {
      discardHabitTimer(elementId);
    }
  }
}

async function refreshForNewCalendarDay(previousDate: string): Promise<void> {
  await finalizeTimersForPreviousDay(previousDate);
  resetInMemoryDailyState();
  await refreshAllDailyData();
}

/** Reload habits and counters when the app calendar day changes or the app returns active. */
export function useDayRolloverRefresh(): void {
  const dateRef = useRef(currentAppCalendarDate());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const handlePotentialRollover = async () => {
      if (!hasAppCalendarDayChanged(dateRef.current) || inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const previousDate = dateRef.current;
      dateRef.current = currentAppCalendarDate();
      try {
        await refreshForNewCalendarDay(previousDate);
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
      subscription.remove();
    };
  }, []);
}
