import type { SQLiteDatabase } from 'expo-sqlite';
import {
  APP_SETTING_KEYS,
  isThemeMode,
  isWeatherLocationMode,
  type AppSettings,
} from '../protocol/appSettings';
import { migrateDailyViewFilter } from '../protocol/dailyView';
import * as settingsRepo from './repositories/settingsRepository';

function parseOptionalNumber(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseNorm(value: string | null): number | undefined {
  const n = parseOptionalNumber(value);
  if (n == null) return undefined;
  return Math.min(1, Math.max(0, n));
}

export async function readAppSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const [
    themeMode,
    dailyViewFilter,
    habitRemindersEnabled,
    weatherWidgetEnabled,
    weatherLocationMode,
    weatherPlaceName,
    weatherLat,
    weatherLon,
    weatherBubbleX,
    weatherBubbleY,
  ] = await Promise.all([
    settingsRepo.getSetting(db, APP_SETTING_KEYS.themeMode),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.dailyViewFilter),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.habitRemindersEnabled),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherWidgetEnabled),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLocationMode),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherPlaceName),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLat),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLon),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherBubbleX),
    settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherBubbleY),
  ]);

  const settings: AppSettings = {};

  if (themeMode && isThemeMode(themeMode)) {
    settings.themeMode = themeMode;
  }
  const migratedFilter = migrateDailyViewFilter(dailyViewFilter);
  if (migratedFilter) {
    settings.dailyViewFilter = migratedFilter;
  }
  if (habitRemindersEnabled === 'true' || habitRemindersEnabled === 'false') {
    settings.habitRemindersEnabled = habitRemindersEnabled === 'true';
  }
  if (weatherWidgetEnabled === 'true' || weatherWidgetEnabled === 'false') {
    settings.weatherWidgetEnabled = weatherWidgetEnabled === 'true';
  }
  if (weatherLocationMode && isWeatherLocationMode(weatherLocationMode)) {
    settings.weatherLocationMode = weatherLocationMode;
  }
  if (weatherPlaceName) {
    settings.weatherPlaceName = weatherPlaceName;
  }
  const lat = parseOptionalNumber(weatherLat);
  const lon = parseOptionalNumber(weatherLon);
  if (lat != null) settings.weatherLat = lat;
  if (lon != null) settings.weatherLon = lon;
  const bubbleX = parseNorm(weatherBubbleX);
  const bubbleY = parseNorm(weatherBubbleY);
  if (bubbleX != null) settings.weatherBubbleX = bubbleX;
  if (bubbleY != null) settings.weatherBubbleY = bubbleY;

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
  if (settings.weatherWidgetEnabled !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherWidgetEnabled,
      settings.weatherWidgetEnabled ? 'true' : 'false',
    );
  }
  if (settings.weatherLocationMode) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherLocationMode,
      settings.weatherLocationMode,
    );
  }
  if (settings.weatherPlaceName) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherPlaceName,
      settings.weatherPlaceName,
    );
  }
  if (settings.weatherLat !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherLat,
      String(settings.weatherLat),
    );
  }
  if (settings.weatherLon !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherLon,
      String(settings.weatherLon),
    );
  }
  if (settings.weatherBubbleX !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherBubbleX,
      String(settings.weatherBubbleX),
    );
  }
  if (settings.weatherBubbleY !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherBubbleY,
      String(settings.weatherBubbleY),
    );
  }
}
