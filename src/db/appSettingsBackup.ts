import type { SQLiteDatabase } from 'expo-sqlite';
import {
  APP_SETTING_KEYS,
  isThemeMode,
  isWeatherLocationMode,
  type AppSettings,
} from '../protocol/appSettings';
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
  // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
  const themeMode = await settingsRepo.getSetting(db, APP_SETTING_KEYS.themeMode);
  const habitRemindersEnabled = await settingsRepo.getSetting(
    db,
    APP_SETTING_KEYS.habitRemindersEnabled,
  );
  const weatherWidgetEnabled = await settingsRepo.getSetting(
    db,
    APP_SETTING_KEYS.weatherWidgetEnabled,
  );
  const calendarWidgetEnabled = await settingsRepo.getSetting(
    db,
    APP_SETTING_KEYS.calendarWidgetEnabled,
  );
  const weatherLocationMode = await settingsRepo.getSetting(
    db,
    APP_SETTING_KEYS.weatherLocationMode,
  );
  const weatherPlaceName = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherPlaceName);
  const weatherLat = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLat);
  const weatherLon = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLon);
  const weatherBubbleX = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherBubbleX);
  const weatherBubbleY = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherBubbleY);

  const settings: AppSettings = {};

  if (themeMode && isThemeMode(themeMode)) {
    settings.themeMode = themeMode;
  }
  if (habitRemindersEnabled === 'true' || habitRemindersEnabled === 'false') {
    settings.habitRemindersEnabled = habitRemindersEnabled === 'true';
  }
  if (weatherWidgetEnabled === 'true' || weatherWidgetEnabled === 'false') {
    settings.weatherWidgetEnabled = weatherWidgetEnabled === 'true';
  }
  if (calendarWidgetEnabled === 'true' || calendarWidgetEnabled === 'false') {
    settings.calendarWidgetEnabled = calendarWidgetEnabled === 'true';
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
  if (settings.calendarWidgetEnabled !== undefined) {
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.calendarWidgetEnabled,
      settings.calendarWidgetEnabled ? 'true' : 'false',
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
