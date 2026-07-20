export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'other';

export interface WeatherCoords {
  lat: number;
  lon: number;
  placeName?: string;
}

export interface WeatherDayForecast {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  tempMeanC: number;
  weatherCode: number;
  condition: WeatherCondition;
  /** Daily max chance of precipitation, 0–100. */
  precipProbabilityPct: number;
}

export interface WeatherForecast {
  currentTempC: number;
  currentWeatherCode: number;
  currentCondition: WeatherCondition;
  /** Today's max precip chance (from daily), 0–100. */
  precipProbabilityPct: number;
  daily: WeatherDayForecast[];
  lat: number;
  lon: number;
  fetchedAt: string;
}

export interface WeatherDailySnapshot {
  date: string;
  tempC: number;
  tempMinC: number;
  tempMaxC: number;
  weatherCode: number;
  condition: WeatherCondition;
  precipProbabilityPct: number | null;
  lat: number | null;
  lon: number | null;
  fetchedAt: string;
}
