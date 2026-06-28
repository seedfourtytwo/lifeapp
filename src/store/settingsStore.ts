import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepository';

const DARK_MODE_KEY = 'dark_mode';

interface SettingsState {
  darkMode: boolean;
  isLoaded: boolean;
  load: () => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: false,
  isLoaded: false,

  load: async () => {
    const db = await getDatabase();
    const value = await settingsRepo.getSetting(db, DARK_MODE_KEY);
    set({
      darkMode: value === 'true',
      isLoaded: true,
    });
  },

  setDarkMode: async (enabled) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, DARK_MODE_KEY, enabled ? 'true' : 'false');
    set({ darkMode: enabled });
  },
}));
