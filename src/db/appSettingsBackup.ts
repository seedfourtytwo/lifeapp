import type { SQLiteDatabase } from 'expo-sqlite';
import {
  APP_SETTING_KEYS,
  isThemeMode,
  type AppSettings,
} from '../protocol/appSettings';
import { isDailyViewFilter } from '../protocol/dailyView';
import * as settingsRepo from './repositories/settingsRepository';

export async function readAppSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const [themeMode, dailyViewFilter, habitRemindersEnabled] = await Promise.all([
    settingsRepo.getSetting(db, APP_SETTING_KEYS.themeMode),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.dailyViewFilter),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.habitRemindersEnabled),
  ]);

  const settings: AppSettings = {};

  if (themeMode && isThemeMode(themeMode)) {
    settings.themeMode = themeMode;
  }
  if (dailyViewFilter && isDailyViewFilter(dailyViewFilter)) {
    settings.dailyViewFilter = dailyViewFilter;
  }
  if (habitRemindersEnabled === 'true' || habitRemindersEnabled === 'false') {
    settings.habitRemindersEnabled = habitRemindersEnabled === 'true';
  }

  return settings;
}

export async function writeAppSettings(
  db: SQLiteDatabase,
  settings: AppSettings | undefined,
): Promise<void> {
  if (!settings) return;

  if (settings.themeMode) {
    await settingsRepo.setSetting(db, APP_SETTING_KEYS.themeMode, settings.themeMode);
  }
  if (settings.dailyViewFilter) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.dailyViewFilter,
      settings.dailyViewFilter,
    );
  }
  if (settings.habitRemindersEnabled !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.habitRemindersEnabled,
      settings.habitRemindersEnabled ? 'true' : 'false',
    );
  }
}
