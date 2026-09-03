export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'other';

/** Near-term outlook vs the next few hours; omit when flat. */
export type WeatherTrend = 'improving' | 'worsening';

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
  /**
   * Mean relative humidity across the day, 0–100.
   *
   * Open-Meteo has no daily humidity variable — this is averaged from the
   * hourly series, so it is null for a day with no hourly coverage and for
   * anything read back from a cache written before humidity existed.
   */
  humidityMeanPct: number | null;
}

export interface WeatherForecast {
  currentTempC: number;
  currentWeatherCode: number;
  currentCondition: WeatherCondition;
  /** Relative humidity right now, 0–100; null when the API omits it. */
  currentHumidityPct: number | null;
  /** Today's max precip chance (from daily), 0–100. */
  precipProbabilityPct: number;
  /** Improving / worsening over the next few hours; null when flat or unknown. */
  trend: WeatherTrend | null;
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
