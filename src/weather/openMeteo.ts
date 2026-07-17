import { weatherCodeToCondition } from './codes';
import type { WeatherCoords, WeatherDayForecast, WeatherForecast } from './types';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface GeocodeResult {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }[];
}

interface ForecastApiResult {
  latitude: number;
  longitude: number;
  current?: {
    temperature_2m: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    temperature_2m_mean?: number[];
  };
}

export async function geocodePlace(query: string): Promise<WeatherCoords | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }

  const data = (await response.json()) as GeocodeResult;
  const hit = data.results?.[0];
  if (!hit) return null;

  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  return {
    lat: hit.latitude,
    lon: hit.longitude,
    placeName: parts.join(', '),
  };
}

export async function fetchForecast(lat: number, lon: number): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean',
    forecast_days: '5',
    timezone: 'auto',
  });

  const response = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Forecast failed (${response.status})`);
  }

  const data = (await response.json()) as ForecastApiResult;
  if (!data.current || !data.daily?.time?.length) {
    throw new Error('Forecast response missing current or daily data');
  }

  const daily: WeatherDayForecast[] = data.daily.time.map((date, index) => {
    const weatherCode = data.daily!.weather_code[index] ?? 0;
    const tempMinC = data.daily!.temperature_2m_min[index] ?? 0;
    const tempMaxC = data.daily!.temperature_2m_max[index] ?? 0;
    const tempMeanC =
      data.daily!.temperature_2m_mean?.[index] ?? (tempMinC + tempMaxC) / 2;
    return {
      date,
      tempMinC,
      tempMaxC,
      tempMeanC,
      weatherCode,
      condition: weatherCodeToCondition(weatherCode),
    };
  });

  const currentCode = data.current.weather_code;
  return {
    currentTempC: data.current.temperature_2m,
    currentWeatherCode: currentCode,
    currentCondition: weatherCodeToCondition(currentCode),
    daily,
    lat: data.latitude,
    lon: data.longitude,
    fetchedAt: new Date().toISOString(),
  };
}
