import { create } from 'zustand';
import { getDatabase } from '../db/client';
import { getDataGeneration } from '../db/dataGeneration';
import { withDbWriteLock } from '../db/writeLock';
import * as settingsRepo from '../db/repositories/settingsRepository';
import { i18n } from '../i18n';
import {
  APP_SETTING_KEYS,
  DEFAULT_EVENING_CHECK_IN_ENABLED,
  DEFAULT_EVENING_CHECK_IN_TIME,
  isAppLanguage,
  isWeatherLocationMode,
  parseEveningCheckInTime,
  type AppLanguage,
  type WeatherLocationMode,
} from '../protocol/appSettings';
import { isThemeMode, type ThemeMode } from '../theme/types';

const LEGACY_DARK_MODE_KEY = 'dark_mode';

let settingsLoadGeneration = 0;

function invalidateSettingsLoads(): void {
  settingsLoadGeneration += 1;
}

async function withGuardedSettingsWrite<T>(fn: () => Promise<T>): Promise<T> {
  const epochAtStart = getDataGeneration('protocol');
  return withDbWriteLock(async () => {
    if (epochAtStart !== getDataGeneration('protocol')) {
      throw new Error(i18n.t('common:errors.dataReplacedTryAgain'));
    }
    const result = await fn();
    invalidateSettingsLoads();
    return result;
  });
}

function parseBool(value: string | null): boolean {
  return value === 'true';
}

function parseOptionalNumber(value: string | null): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface SettingsState {
  themeMode: ThemeMode;
  appLanguage: AppLanguage;
  eveningCheckInEnabled: boolean;
  eveningCheckInTime: string;
  weatherWidgetEnabled: boolean;
  weatherLocationMode: WeatherLocationMode;
  weatherPlaceName: string | null;
  weatherLat: number | null;
  weatherLon: number | null;
  isLoaded: boolean;
  load: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAppLanguage: (language: AppLanguage) => Promise<void>;
  setEveningCheckInEnabled: (enabled: boolean) => Promise<void>;
  setEveningCheckInTime: (time: string) => Promise<void>;
  setWeatherWidgetEnabled: (enabled: boolean) => Promise<void>;
  setWeatherLocationMode: (mode: WeatherLocationMode) => Promise<void>;
  setWeatherPlace: (place: {
    placeName: string;
    lat: number;
    lon: number;
  }) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'light',
  appLanguage: 'system',
  eveningCheckInEnabled: DEFAULT_EVENING_CHECK_IN_ENABLED,
  eveningCheckInTime: DEFAULT_EVENING_CHECK_IN_TIME,
  weatherWidgetEnabled: false,
  weatherLocationMode: 'manual',
  weatherPlaceName: null,
  weatherLat: null,
  weatherLon: null,
  isLoaded: false,

  load: async () => {
    const generation = ++settingsLoadGeneration;

    const readOnce = async () => {
      await withDbWriteLock(async () => {
        if (generation !== settingsLoadGeneration) return;
        const db = await getDatabase();
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
          LEGACY_DARK_MODE_KEY,
        ]);

        const storedMode = stored.get(APP_SETTING_KEYS.themeMode) ?? null;
        const storedLanguage = stored.get(APP_SETTING_KEYS.appLanguage) ?? null;
        const storedEveningEnabled =
          stored.get(APP_SETTING_KEYS.eveningCheckInEnabled) ?? null;
        const storedEveningTime = stored.get(APP_SETTING_KEYS.eveningCheckInTime) ?? null;
        const storedLegacyReminders =
          stored.get(APP_SETTING_KEYS.habitRemindersEnabled) ?? null;
        const storedWeatherEnabled =
          stored.get(APP_SETTING_KEYS.weatherWidgetEnabled) ?? null;
        const storedLocationMode =
          stored.get(APP_SETTING_KEYS.weatherLocationMode) ?? null;
        const storedPlaceName = stored.get(APP_SETTING_KEYS.weatherPlaceName) ?? null;
        const storedLat = stored.get(APP_SETTING_KEYS.weatherLat) ?? null;
        const storedLon = stored.get(APP_SETTING_KEYS.weatherLon) ?? null;

        let themeMode: ThemeMode = 'light';
        if (storedMode && isThemeMode(storedMode)) {
          themeMode = storedMode;
        } else {
          const legacyDark = stored.get(LEGACY_DARK_MODE_KEY) ?? null;
          themeMode = legacyDark === 'true' ? 'dark' : 'light';
        }

        const appLanguage: AppLanguage =
          storedLanguage && isAppLanguage(storedLanguage) ? storedLanguage : 'system';

        const weatherLocationMode =
          storedLocationMode && isWeatherLocationMode(storedLocationMode)
            ? storedLocationMode
            : 'manual';

        // Nothing stored at all means the user has never chosen — not that
        // they said no. Only a stored value can turn the reminder off.
        const eveningCheckInEnabled =
          storedEveningEnabled != null
            ? parseBool(storedEveningEnabled)
            : storedLegacyReminders != null
              ? parseBool(storedLegacyReminders)
              : DEFAULT_EVENING_CHECK_IN_ENABLED;
        const eveningCheckInTime =
          parseEveningCheckInTime(storedEveningTime) ?? DEFAULT_EVENING_CHECK_IN_TIME;

        // One-time migrate legacy habit_reminders_enabled → evening_check_in_enabled.
        if (storedEveningEnabled == null && storedLegacyReminders != null) {
          await settingsRepo.setSetting(
            db,
            APP_SETTING_KEYS.eveningCheckInEnabled,
            eveningCheckInEnabled ? 'true' : 'false',
          );
        }
        if (storedEveningTime == null) {
          await settingsRepo.setSetting(
            db,
            APP_SETTING_KEYS.eveningCheckInTime,
            eveningCheckInTime,
          );
        }

        if (generation !== settingsLoadGeneration) return;

        set({
          themeMode,
          appLanguage,
          eveningCheckInEnabled,
          eveningCheckInTime,
          weatherWidgetEnabled: parseBool(storedWeatherEnabled),
          weatherLocationMode,
          weatherPlaceName: storedPlaceName,
          weatherLat: parseOptionalNumber(storedLat),
          weatherLon: parseOptionalNumber(storedLon),
          isLoaded: true,
        });
      });
    };

    try {
      await readOnce();
    } catch (error) {
      console.error('Failed to load settings', error);
      if (generation !== settingsLoadGeneration) return;
      try {
        await readOnce();
      } catch (retryError) {
        console.error('Failed to load settings (retry)', retryError);
        if (generation !== settingsLoadGeneration) return;
        // Degraded boot with defaults — avoid an infinite splash spinner.
        set({ isLoaded: true });
      }
    }
  },

  setThemeMode: async (mode) => {
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await settingsRepo.setSetting(db, APP_SETTING_KEYS.themeMode, mode);
      set({ themeMode: mode });
    });
  },

  setAppLanguage: async (language) => {
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await settingsRepo.setSetting(db, APP_SETTING_KEYS.appLanguage, language);
      set({ appLanguage: language });
    });
  },

  setEveningCheckInEnabled: async (enabled) => {
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await settingsRepo.setSetting(
        db,
        APP_SETTING_KEYS.eveningCheckInEnabled,
        enabled ? 'true' : 'false',
      );
      set({ eveningCheckInEnabled: enabled });
    });
  },

  setEveningCheckInTime: async (time) => {
    const parsed = parseEveningCheckInTime(time);
    if (!parsed) return;
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await settingsRepo.setSetting(db, APP_SETTING_KEYS.eveningCheckInTime, parsed);
      set({ eveningCheckInTime: parsed });
    });
  },

  setWeatherWidgetEnabled: async (enabled) => {
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await settingsRepo.setSetting(
        db,
        APP_SETTING_KEYS.weatherWidgetEnabled,
        enabled ? 'true' : 'false',
      );
      set({ weatherWidgetEnabled: enabled });
    });
  },

  setWeatherLocationMode: async (mode) => {
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherLocationMode, mode);
      set({ weatherLocationMode: mode });
    });
  },

  setWeatherPlace: async ({ placeName, lat, lon }) => {
    await withGuardedSettingsWrite(async () => {
      const db = await getDatabase();
      await db.withTransactionAsync(async () => {
        await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherPlaceName, placeName);
        await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherLat, String(lat));
        await settingsRepo.setSetting(db, APP_SETTING_KEYS.weatherLon, String(lon));
      });
      set({ weatherPlaceName: placeName, weatherLat: lat, weatherLon: lon });
    });
  },
}));
