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
}

export interface WeatherForecast {
  currentTempC: number;
  currentWeatherCode: number;
  currentCondition: WeatherCondition;
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
  lat: number | null;
  lon: number | null;
  fetchedAt: string;
}
