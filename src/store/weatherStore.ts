import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as weatherRepo from '../db/repositories/weatherRepository';
import { toDateString } from '../protocol';
import { useSettingsStore } from './settingsStore';
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
  error: string | null;
  lastFetchAt: number | null;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  clear: () => void;
}

async function resolveCoords(): Promise<WeatherCoords | null> {
  const {
    weatherLocationMode,
    weatherLat,
    weatherLon,
    weatherPlaceName,
  } = useSettingsStore.getState();

  if (weatherLocationMode === 'device' && isDeviceLocationAvailable()) {
    const granted = await requestDeviceLocationPermission();
    if (granted) {
      const device = await getDeviceCoords();
      if (device) return device;
    }
  }

  if (weatherLat != null && weatherLon != null) {
    return {
      lat: weatherLat,
      lon: weatherLon,
      placeName: weatherPlaceName ?? undefined,
    };
  }

  return null;
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  forecast: null,
  loading: false,
  error: null,
  lastFetchAt: null,

  clear: () => {
    set({ forecast: null, loading: false, error: null, lastFetchAt: null });
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

    set({ loading: true, error: null });

    try {
      const coords = await resolveCoords();
      if (!coords) {
        set({
          loading: false,
          error: 'Set a location in Settings to show weather.',
        });
        return;
      }

      const next = await fetchForecast(coords.lat, coords.lon);
      const today = toDateString(new Date());
      const todayDaily = next.daily.find((d) => d.date === today) ?? next.daily[0];

      if (todayDaily) {
        const db = await getDatabase();
        await weatherRepo.upsertWeatherDaily(db, {
          date: todayDaily.date,
          tempC: todayDaily.tempMeanC,
          tempMinC: todayDaily.tempMinC,
          tempMaxC: todayDaily.tempMaxC,
          weatherCode: todayDaily.weatherCode,
          condition: todayDaily.condition,
          lat: next.lat,
          lon: next.lon,
          fetchedAt: next.fetchedAt,
        });
      }

      set({
        forecast: next,
        loading: false,
        error: null,
        lastFetchAt: Date.now(),
      });
    } catch (error) {
      console.error('Weather refresh failed', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Weather unavailable',
      });
    }
  },
}));
