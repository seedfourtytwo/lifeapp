import { useCallback } from 'react';
import type { HabitConfig } from '../protocol';
import {
  markHabitTimerDone,
  pressHabitTimer,
  resetHabitTimerToday,
  unmarkHabitTimerDone,
} from '../habitTimer/habitTimerControls';

/** Couples habit timer store actions with bundled sound + lock-screen media controls. */
export function useHabitTimerControls() {
  const handleMarkDone = useCallback(
    (elementId: string, config: HabitConfig) => markHabitTimerDone(elementId, config),
    [],
  );

  const handleUnmarkDone = useCallback(
    (elementId: string, config: HabitConfig) => unmarkHabitTimerDone(elementId, config),
    [],
  );

  const handleTimerPress = useCallback((elementId: string, config: HabitConfig) => {
    pressHabitTimer(elementId, config);
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
