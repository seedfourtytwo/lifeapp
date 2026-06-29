import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepository';
import {
  isDailyViewFilter,
  type DailyViewFilter,
} from '../protocol';
import { isThemeMode, type ThemeMode } from '../theme/types';

const THEME_MODE_KEY = 'theme_mode';
const LEGACY_DARK_MODE_KEY = 'dark_mode';
const DAILY_VIEW_FILTER_KEY = 'daily_view_filter';
const HABIT_REMINDERS_KEY = 'habit_reminders_enabled';

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
  dailyViewFilter: 'all_due',
  habitRemindersEnabled: false,
  isLoaded: false,

  load: async () => {
    try {
      const db = await getDatabase();
      const storedMode = await settingsRepo.getSetting(db, THEME_MODE_KEY);
      const storedFilter = await settingsRepo.getSetting(db, DAILY_VIEW_FILTER_KEY);
      const storedReminders = await settingsRepo.getSetting(db, HABIT_REMINDERS_KEY);

      let themeMode: ThemeMode = 'light';
      if (storedMode && isThemeMode(storedMode)) {
        themeMode = storedMode;
      } else {
        const legacyDark = await settingsRepo.getSetting(db, LEGACY_DARK_MODE_KEY);
        themeMode = legacyDark === 'true' ? 'dark' : 'light';
      }

      set({
        themeMode,
        dailyViewFilter:
          storedFilter && isDailyViewFilter(storedFilter) ? storedFilter : 'all_due',
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
    await settingsRepo.setSetting(db, THEME_MODE_KEY, mode);
    set({ themeMode: mode });
  },

  setDailyViewFilter: async (filter) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, DAILY_VIEW_FILTER_KEY, filter);
    set({ dailyViewFilter: filter });
  },

  setHabitRemindersEnabled: async (enabled) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, HABIT_REMINDERS_KEY, enabled ? 'true' : 'false');
    set({ habitRemindersEnabled: enabled });
  },
}));
