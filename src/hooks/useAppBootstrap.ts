import { useEffect } from 'react';
import { useElementStore } from '../store/elementStore';
import { useSettingsStore } from '../store/settingsStore';

/** Loads persisted settings and elements once at app start. */
export function useAppBootstrap(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadElements = useElementStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!settingsLoaded) return;
    void loadElements();
  }, [loadElements, settingsLoaded]);
}
