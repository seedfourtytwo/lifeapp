import { useCallback } from 'react';
import type { HabitConfig } from '../protocol';
import {
  finishHabitTimer,
  pressHabitTimer,
  resetHabitTimerToday,
} from '../habits/habitTimerControls';

/** Couples habit timer store actions with bundled sound + lock-screen media controls. */
export function useHabitTimerControls() {
  const handleFinishTimer = useCallback(
    (elementId: string, config: HabitConfig, trackCompleted = false) =>
      finishHabitTimer(elementId, config, trackCompleted),
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
    handleFinishTimer,
    handleResetToday,
  };
}
