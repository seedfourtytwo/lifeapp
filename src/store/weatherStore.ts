import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as weatherRepo from '../db/repositories/weatherRepository';
import { toDateString } from '../protocol';
import { useSettingsStore } from './settingsStore';
import {
  classifyWeatherFetchError,
  weatherErrorMessage,
} from '../weather/errors';
import {
  clearCachedForecast,
  loadCachedForecast,
  saveCachedForecast,
} from '../weather/forecastCache';
import {
  getDeviceCoords,
  isDeviceLocationAvailable,
  requestDeviceLocationPermission,
} from '../weather/deviceLocation';
import { fetchForecast } from '../weather/openMeteo';
import type { WeatherCoords, WeatherForecast } from '../weather/types';

const REFRESH_MS = 3 * 60 * 60 * 1000;

interface WeatherState {
  forecast: WeatherForecast | null;
  loading: boolean;
  /** User-facing status under the bubble (e.g. No connection). */
  error: string | null;
  /** True when the last fetch failed due to network / timeout. */
  offline: boolean;
  lastFetchAt: number | null;
  refresh: (opts?: { force?: boolean; refreshGps?: boolean }) => Promise<void>;
  hydrateFromCache: () => Promise<void>;
  clear: () => void;
}

function savedCoords(): WeatherCoords | null {
  const { weatherLat, weatherLon, weatherPlaceName } = useSettingsStore.getState();
  if (weatherLat == null || weatherLon == null) return null;
  return {
    lat: weatherLat,
    lon: weatherLon,
    placeName: weatherPlaceName ?? undefined,
  };
}

/**
 * Prefer last-known coordinates so offline / quick refresh still works.
 * Only hit GPS when explicitly requested (Settings → Use phone location).
 */
async function resolveCoords(refreshGps: boolean): Promise<WeatherCoords | null> {
  const { weatherLocationMode } = useSettingsStore.getState();
  const saved = savedCoords();

  if (refreshGps && weatherLocationMode === 'device' && isDeviceLocationAvailable()) {
    const granted = await requestDeviceLocationPermission();
    if (granted) {
      try {
        const device = await getDeviceCoords();
        if (device) return device;
      } catch {
        // fall through to saved
      }
    }
  }

  return saved;
}

async function persistDailySnapshot(forecast: WeatherForecast): Promise<void> {
  const today = toDateString(new Date());
  const todayDaily = forecast.daily.find((d) => d.date === today) ?? forecast.daily[0];
  if (!todayDaily) return;

  try {
    const db = await getDatabase();
    await weatherRepo.upsertWeatherDaily(db, {
      date: todayDaily.date,
      tempC: todayDaily.tempMeanC,
      tempMinC: todayDaily.tempMinC,
      tempMaxC: todayDaily.tempMaxC,
      weatherCode: todayDaily.weatherCode,
      condition: todayDaily.condition,
      precipProbabilityPct: todayDaily.precipProbabilityPct,
      lat: forecast.lat,
      lon: forecast.lon,
      fetchedAt: forecast.fetchedAt,
    });
  } catch (error) {
    // Snapshot is best-effort — don't hide a successful forecast
    console.error('Failed to persist weather_daily snapshot', error);
  }
}

let refreshSeq = 0;

export const useWeatherStore = create<WeatherState>((set, get) => ({
  forecast: null,
  loading: false,
  error: null,
  offline: false,
  lastFetchAt: null,

  clear: () => {
    set({
      forecast: null,
      loading: false,
      error: null,
      offline: false,
      lastFetchAt: null,
    });
    void clearCachedForecast();
  },

  hydrateFromCache: async () => {
    if (get().forecast) return;
    const cached = await loadCachedForecast();
    if (cached) {
      set({ forecast: cached, offline: true, error: null });
    }
  },

  refresh: async (opts) => {
    const { weatherWidgetEnabled } = useSettingsStore.getState();
    if (!weatherWidgetEnabled) {
      get().clear();
      return;
    }

    const now = Date.now();
    const { lastFetchAt, forecast, loading } = get();
    if (loading) return;
    if (
      !opts?.force &&
      forecast &&
      lastFetchAt != null &&
      now - lastFetchAt < REFRESH_MS
    ) {
      return;
    }

    if (!get().forecast) {
      await get().hydrateFromCache();
    }

    const seq = ++refreshSeq;
    set({ loading: true });

    try {
      const coords = await resolveCoords(opts?.refreshGps === true);
      if (!coords) {
        if (seq !== refreshSeq) return;
        set({
          loading: false,
          offline: false,
          error: 'Set a location in Settings',
        });
        return;
      }

      const next = await fetchForecast(coords.lat, coords.lon);
      if (seq !== refreshSeq) return;

      await saveCachedForecast(next);
      await persistDailySnapshot(next);

      set({
        forecast: next,
        loading: false,
        error: null,
        offline: false,
        lastFetchAt: Date.now(),
      });
    } catch (error) {
      console.error('Weather refresh failed', error);
      if (seq !== refreshSeq) return;

      const kind = classifyWeatherFetchError(error);
      const cached = get().forecast ?? (await loadCachedForecast());
      set({
        forecast: cached,
        loading: false,
        offline: kind === 'offline',
        error: weatherErrorMessage(kind),
        lastFetchAt: get().lastFetchAt,
      });
    }
  },
}));
