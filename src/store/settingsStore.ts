import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepository';
import { isThemeMode, type ThemeMode } from '../theme/types';

const THEME_MODE_KEY = 'theme_mode';
const LEGACY_DARK_MODE_KEY = 'dark_mode';

interface SettingsState {
  themeMode: ThemeMode;
  isLoaded: boolean;
  load: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'light',
  isLoaded: false,

  load: async () => {
    const db = await getDatabase();
    const storedMode = await settingsRepo.getSetting(db, THEME_MODE_KEY);
    if (storedMode && isThemeMode(storedMode)) {
      set({ themeMode: storedMode, isLoaded: true });
      return;
    }

    // Migrate from the old on/off dark mode setting.
    const legacyDark = await settingsRepo.getSetting(db, LEGACY_DARK_MODE_KEY);
    const themeMode: ThemeMode = legacyDark === 'true' ? 'dark' : 'light';
    set({ themeMode, isLoaded: true });
  },

  setThemeMode: async (mode) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, THEME_MODE_KEY, mode);
    set({ themeMode: mode });
  },
}));
