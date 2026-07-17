import type { WeatherCondition } from './types';

/** Map WMO weather interpretation codes (Open-Meteo) to a small condition set. */
export function weatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  ) {
    return 'rain';
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow';
  }
  return 'other';
}

export function conditionIconName(
  condition: WeatherCondition,
): 'weather-sunny' | 'weather-cloudy' | 'weather-rainy' | 'weather-snowy' | 'weather-partly-cloudy' {
  switch (condition) {
    case 'sunny':
      return 'weather-sunny';
    case 'cloudy':
      return 'weather-cloudy';
    case 'rain':
      return 'weather-rainy';
    case 'snow':
      return 'weather-snowy';
    default:
      return 'weather-partly-cloudy';
  }
}

export function conditionLabel(condition: WeatherCondition): string {
  switch (condition) {
    case 'sunny':
      return 'Sunny';
    case 'cloudy':
      return 'Cloudy';
    case 'rain':
      return 'Rain';
    case 'snow':
      return 'Snow';
    default:
      return 'Mixed';
  }
}
