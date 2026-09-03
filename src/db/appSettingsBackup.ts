import type { SQLiteDatabase } from 'expo-sqlite';
import {
  APP_SETTING_KEYS,
  DEFAULT_EVENING_CHECK_IN_TIME,
  isAppLanguage,
  isThemeMode,
  isWeatherLocationMode,
  parseEveningCheckInTime,
  type AppSettings,
} from '../protocol/appSettings';
import * as settingsRepo from './repositories/settingsRepository';

function parseOptionalNumber(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseStoredBool(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function readAppSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const stored = await settingsRepo.getSettings(db, [
    APP_SETTING_KEYS.themeMode,
    APP_SETTING_KEYS.appLanguage,
    APP_SETTING_KEYS.eveningCheckInEnabled,
    APP_SETTING_KEYS.eveningCheckInTime,
    APP_SETTING_KEYS.habitRemindersEnabled,
    APP_SETTING_KEYS.weatherWidgetEnabled,
    APP_SETTING_KEYS.weatherLocationMode,
    APP_SETTING_KEYS.weatherPlaceName,
    APP_SETTING_KEYS.weatherLat,
    APP_SETTING_KEYS.weatherLon,
    APP_SETTING_KEYS.foodJournalNotebookId,
  ]);

  const themeMode = stored.get(APP_SETTING_KEYS.themeMode) ?? null;
  const appLanguage = stored.get(APP_SETTING_KEYS.appLanguage) ?? null;
  const eveningCheckInEnabled = stored.get(APP_SETTING_KEYS.eveningCheckInEnabled) ?? null;
  const eveningCheckInTime = stored.get(APP_SETTING_KEYS.eveningCheckInTime) ?? null;
  const legacyHabitReminders = stored.get(APP_SETTING_KEYS.habitRemindersEnabled) ?? null;
  const weatherWidgetEnabled = stored.get(APP_SETTING_KEYS.weatherWidgetEnabled) ?? null;
  const weatherLocationMode = stored.get(APP_SETTING_KEYS.weatherLocationMode) ?? null;
  const weatherPlaceName = stored.get(APP_SETTING_KEYS.weatherPlaceName) ?? null;
  const weatherLat = stored.get(APP_SETTING_KEYS.weatherLat) ?? null;
  const weatherLon = stored.get(APP_SETTING_KEYS.weatherLon) ?? null;
  const foodJournalNotebookId =
    stored.get(APP_SETTING_KEYS.foodJournalNotebookId) ?? null;

  const settings: AppSettings = {};

  if (themeMode && isThemeMode(themeMode)) {
    settings.themeMode = themeMode;
  }
  if (appLanguage && isAppLanguage(appLanguage)) {
    settings.appLanguage = appLanguage;
  }
  const eveningEnabled =
    parseStoredBool(eveningCheckInEnabled) ?? parseStoredBool(legacyHabitReminders);
  if (eveningEnabled !== undefined) {
    settings.eveningCheckInEnabled = eveningEnabled;
  }
  const parsedTime = parseEveningCheckInTime(eveningCheckInTime);
  if (parsedTime) {
    settings.eveningCheckInTime = parsedTime;
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
  if (foodJournalNotebookId) {
    settings.foodJournalNotebookId = foodJournalNotebookId;
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
  if (settings.appLanguage) {
    await settingsRepo.setSetting(db, APP_SETTING_KEYS.appLanguage, settings.appLanguage);
  }
  if (settings.eveningCheckInEnabled !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.eveningCheckInEnabled,
      settings.eveningCheckInEnabled ? 'true' : 'false',
    );
  }
  if (settings.eveningCheckInTime !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.eveningCheckInTime,
      settings.eveningCheckInTime || DEFAULT_EVENING_CHECK_IN_TIME,
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
  if (settings.foodJournalNotebookId) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.foodJournalNotebookId,
      settings.foodJournalNotebookId,
    );
  }
}
