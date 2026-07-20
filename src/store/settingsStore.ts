import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepository';
import {
  APP_SETTING_KEYS,
  isWeatherLocationMode,
  type WeatherLocationMode,
} from '../protocol/appSettings';
import { isThemeMode, type ThemeMode } from '../theme/types';
import { defaultBubblePosition } from '../weather/bubblePosition';

const LEGACY_DARK_MODE_KEY = 'dark_mode';
const DEFAULT_BUBBLE = defaultBubblePosition();

function parseBool(value: string | null): boolean {
  return value === 'true';
}

function parseOptionalNumber(value: string | null): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseNorm(value: string | null, fallback: number): number {
  const n = parseOptionalNumber(value);
  if (n == null) return fallback;
  return Math.min(1, Math.max(0, n));
}

interface SettingsState {
  themeMode: ThemeMode;
  habitRemindersEnabled: boolean;
  weatherWidgetEnabled: boolean;
  calendarWidgetEnabled: boolean;
  weatherLocationMode: WeatherLocationMode;
  weatherPlaceName: string | null;
  weatherLat: number | null;
  weatherLon: number | null;
  weatherBubbleX: number;
  weatherBubbleY: number;
  isLoaded: boolean;
  load: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setHabitRemindersEnabled: (enabled: boolean) => Promise<void>;
  setWeatherWidgetEnabled: (enabled: boolean) => Promise<void>;
  setCalendarWidgetEnabled: (enabled: boolean) => Promise<void>;
  setWeatherLocationMode: (mode: WeatherLocationMode) => Promise<void>;
  setWeatherPlace: (place: {
    placeName: string;
    lat: number;
    lon: number;
  }) => Promise<void>;
  setWeatherBubblePosition: (x: number, y: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'light',
  habitRemindersEnabled: false,
  weatherWidgetEnabled: false,
  calendarWidgetEnabled: false,
  weatherLocationMode: 'manual',
  weatherPlaceName: null,
  weatherLat: null,
  weatherLon: null,
  weatherBubbleX: DEFAULT_BUBBLE.x,
  weatherBubbleY: DEFAULT_BUBBLE.y,
  isLoaded: false,

  load: async () => {
    try {
      const db = await getDatabase();
      // Sequential reads — concurrent prepareAsync on the same DB can release statements early.
      const storedMode = await settingsRepo.getSetting(db, APP_SETTING_KEYS.themeMode);
      const storedReminders = await settingsRepo.getSetting(
        db,
        APP_SETTING_KEYS.habitRemindersEnabled,
      );
      const storedWeatherEnabled = await settingsRepo.getSetting(
        db,
        APP_SETTING_KEYS.weatherWidgetEnabled,
      );
      const storedCalendarEnabled = await settingsRepo.getSetting(
        db,
        APP_SETTING_KEYS.calendarWidgetEnabled,
      );
      const storedLocationMode = await settingsRepo.getSetting(
        db,
        APP_SETTING_KEYS.weatherLocationMode,
      );
      const storedPlaceName = await settingsRepo.getSetting(
        db,
        APP_SETTING_KEYS.weatherPlaceName,
      );
      const storedLat = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLat);
      const storedLon = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherLon);
      const storedBubbleX = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherBubbleX);
      const storedBubbleY = await settingsRepo.getSetting(db, APP_SETTING_KEYS.weatherBubbleY);

      let themeMode: ThemeMode = 'light';
      if (storedMode && isThemeMode(storedMode)) {
        themeMode = storedMode;
      } else {
        const legacyDark = await settingsRepo.getSetting(db, LEGACY_DARK_MODE_KEY);
        themeMode = legacyDark === 'true' ? 'dark' : 'light';
      }

      const weatherLocationMode =
        storedLocationMode && isWeatherLocationMode(storedLocationMode)
          ? storedLocationMode
          : 'manual';

      set({
        themeMode,
        habitRemindersEnabled: parseBool(storedReminders),
        weatherWidgetEnabled: parseBool(storedWeatherEnabled),
        calendarWidgetEnabled: parseBool(storedCalendarEnabled),
        weatherLocationMode,
        weatherPlaceName: storedPlaceName,
        weatherLat: parseOptionalNumber(storedLat),
        weatherLon: parseOptionalNumber(storedLon),
        weatherBubbleX: parseNorm(storedBubbleX, DEFAULT_BUBBLE.x),
        weatherBubbleY: parseNorm(storedBubbleY, DEFAULT_BUBBLE.y),
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

  setHabitRemindersEnabled: async (enabled) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.habitRemindersEnabled,
      enabled ? 'true' : 'false',
    );
    set({ habitRemindersEnabled: enabled });
  },

  setWeatherWidgetEnabled: async (enabled) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.weatherWidgetEnabled,
      enabled ? 'true' : 'false',
    );
    set({ weatherWidgetEnabled: enabled });
  },

  setCalendarWidgetEnabled: async (enabled) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(
      db,
      APP_SETTING_KEYS.calendarWidgetEnabled,
      enabled ? 'true' : 'false',
    );
    set({ calendarWidgetEnabled: enabled });
  },

  setWeatherLocationMode: async (mode) => {
    const db = await getDatabase();
    await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherLocationMode, mode);
    set({ weatherLocationMode: mode });
  },

  setWeatherPlace: async ({ placeName, lat, lon }) => {
    const db = await getDatabase();
    await Promise.all([
      settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherPlaceName, placeName),
      settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherLat, String(lat)),
      settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherLon, String(lon)),
    ]);
    set({ weatherPlaceName: placeName, weatherLat: lat, weatherLon: lon });
  },

  setWeatherBubblePosition: async (x, y) => {
    const clampedX = Math.min(1, Math.max(0, x));
    const clampedY = Math.min(1, Math.max(0, y));
    // Optimistic UI — persist after so dragging stays smooth
    set({ weatherBubbleX: clampedX, weatherBubbleY: clampedY });
    try {
      const db = await getDatabase();
      await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherBubbleX, String(clampedX));
      await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherBubbleY, String(clampedY));
    } catch (error) {
      console.error('Failed to save weather bubble position', error);
    }
  },
}));
