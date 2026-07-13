import { useEffect, useMemo } from 'react';
import { warmupHabitSoundPlayback } from '../audio/habitTimerSound';
import { warmupHabitCompleteChime } from '../audio/habitCompleteSound';
import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { useElementStore } from '../store/elementStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getPinnedHabits, pinnedHabitIdsKey } from '../utils/dashboardElements';

/** Loads settings, elements, habit state, and warms timer sounds at app start. */
export function useAppBootstrap(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadElements = useElementStore((s) => s.load);
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const elementsLoading = useElementStore((s) => s.isLoading);
  const loadHabitDayState = useEventStore((s) => s.loadHabitDayState);
  const loadHabitStreaks = useEventStore((s) => s.loadHabitStreaks);

  const pinnedHabitKey = useMemo(
    () => pinnedHabitIdsKey(elements, dashboard),
    [elements, dashboard],
  );

  useEffect(() => {
    void loadSettings();
    void warmupHabitSoundPlayback();
    void warmupHabitCompleteChime();
  }, [loadSettings]);

  useEffect(() => {
    if (!settingsLoaded) return;
    void loadElements();
  }, [loadElements, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || elementsLoading || !pinnedHabitKey) return;

    const habitElements = getPinnedHabits(elements, dashboard);
    const inputs = habitStreakInputsFromElements(habitElements);
    if (inputs.length > 0) {
      void loadHabitDayState(inputs);
      void loadHabitStreaks(inputs);
    }

    void preloadConfiguredHabitSounds(habitElements);
  }, [
    dashboard,
    elements,
    elementsLoading,
    loadHabitDayState,
    loadHabitStreaks,
    pinnedHabitKey,
    settingsLoaded,
  ]);
}
