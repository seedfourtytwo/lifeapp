import { useCallback } from 'react';
import type { HabitConfig } from '../protocol';
import {
  markHabitTimerDone,
  pressHabitTimer,
  resetHabitTimerToday,
  unmarkHabitTimerDone,
} from '../habitTimer/habitTimerControls';

/** The habit card's timer controls; the native core plays the session. */
export function useHabitTimerControls() {
  const handleMarkDone = useCallback(
    (elementId: string, config: HabitConfig) => markHabitTimerDone(elementId, config),
    [],
  );

  const handleUnmarkDone = useCallback(
    (elementId: string, config: HabitConfig) => unmarkHabitTimerDone(elementId, config),
    [],
  );

  const handleTimerPress = useCallback((elementId: string) => {
    pressHabitTimer(elementId);
  }, []);

  const handleResetToday = useCallback(
    (elementId: string, config: HabitConfig) => resetHabitTimerToday(elementId, config),
    [],
  );

  return {
    handleTimerPress,
    handleMarkDone,
    handleUnmarkDone,
    handleResetToday,
  };
}
