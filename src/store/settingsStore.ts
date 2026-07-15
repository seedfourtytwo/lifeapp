import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepository';
import { APP_SETTING_KEYS } from '../protocol/appSettings';
import {
  migrateDailyViewFilter,
  type DailyViewFilter,
} from '../protocol';
import { isThemeMode, type ThemeMode } from '../theme/types';

const LEGACY_DARK_MODE_KEY = 'dark_mode';
const DEFAULT_DAILY_VIEW_FILTER: DailyViewFilter = 'remaining';

interface SettingsState {
  themeMode: ThemeMode;
  dailyViewFilter: DailyViewFilter;
  habitRemindersEnabled: boolean;
  isLoaded: boolean;
  load: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setDailyViewFilter: (filter: DailyViewFilter) => Promise<void>;
  setHabitRemindersEnabled: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'light',
  dailyViewFilter: DEFAULT_DAILY_VIEW_FILTER,
  habitRemindersEnabled: false,
  isLoaded: false,

  load: async () => {
    try {
      const db = await getDatabase();
      const storedMode = await settingsRepo.getSetting(db, APP_SETTING_KEYS.themeMode);
      const storedFilter = await settingsRepo.getSetting(db, APP_SETTING_KEYS.dailyViewFilter);
      const storedReminders = await settingsRepo.getSetting(
        db,
        APP_SETTING_KEYS.habitRemindersEnabled,
      );

      let themeMode: ThemeMode = 'light';
      if (storedMode && isThemeMode(storedMode)) {
        themeMode = storedMode;
      } else {
        const legacyDark = await settingsRepo.getSetting(db, LEGACY_DARK_MODE_KEY);
        themeMode = legacyDark === 'true' ? 'dark' : 'light';
      }

      const dailyViewFilter =
        migrateDailyViewFilter(storedFilter) ?? DEFAULT_DAILY_VIEW_FILTER;

      set({
        themeMode,
        dailyViewFilter,
        habitRemindersEnabled: storedReminders === 'true',
        isLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load settings', error);
      set({ isLoaded: true });
    }
  },

  setThemeMode: async (mode) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, APP_SETTING_KEYS.themeMode, mode);
    set({ themeMode: mode });
  },

  setDailyViewFilter: async (filter) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, APP_SETTING_KEYS.dailyViewFilter, filter);
    set({ dailyViewFilter: filter });
  },

  setHabitRemindersEnabled: async (enabled) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.habitRemindersEnabled,
      enabled ? 'true' : 'false',
    );
    set({ habitRemindersEnabled: enabled });
  },
}));
