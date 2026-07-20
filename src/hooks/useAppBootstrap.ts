import { useEffect, useMemo } from 'react';
import { warmupHabitSoundPlayback } from '../audio/habitTimerSound';
import { warmupHabitCompleteChime } from '../audio/habitCompleteSound';
import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { useCalendarStore } from '../store/calendarStore';
import { useElementStore } from '../store/elementStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveHabits } from '../utils/dashboardElements';

/**
 * Identity of active habits that should reload streaks / warm sounds.
 * Includes config so target/schedule edits refresh streaks without renaming thrashing
 * day-state (focus refresh owns today's completion map).
 */
function activeHabitBootstrapKey(
  elements: ReturnType<typeof useElementStore.getState>['elements'],
  dashboard: ReturnType<typeof useElementStore.getState>['dashboard'],
): string {
  return getActiveHabits(elements, dashboard)
    .map((habit) => `${habit.id}:${JSON.stringify(habit.config)}`)
    .sort()
    .join('|');
}

/** Loads settings, elements, habit streaks, and warms timer sounds at app start. */
export function useAppBootstrap(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadElements = useElementStore((s) => s.load);
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const elementsLoading = useElementStore((s) => s.isLoading);
  const loadHabitStreaks = useEventStore((s) => s.loadHabitStreaks);

  const bootstrapKey = useMemo(
    () => activeHabitBootstrapKey(elements, dashboard),
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
    void useCalendarStore.getState().load();
  }, [loadElements, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || elementsLoading) return;

    const { elements: latestElements, dashboard: latestDashboard } = useElementStore.getState();
    const habitElements = getActiveHabits(latestElements, latestDashboard);
    if (habitElements.length === 0) return;

    const inputs = habitStreakInputsFromElements(habitElements);
    // Day-state is loaded on Habits focus — avoid a duplicate cold-start query.
    void loadHabitStreaks(inputs);
    void preloadConfiguredHabitSounds(habitElements);
  }, [bootstrapKey, elementsLoading, loadHabitStreaks, settingsLoaded]);
}
