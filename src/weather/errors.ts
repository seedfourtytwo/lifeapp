import { i18n } from '../i18n';

export type WeatherFetchFailureKind = 'offline' | 'http' | 'invalid' | 'unknown';

export function classifyWeatherFetchError(error: unknown): WeatherFetchFailureKind {
  if (error instanceof TypeError) {
    // fetch() network failures are typically TypeError in RN / browsers
    return 'offline';
  }
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return 'offline';
  }
  if (lower.includes('forecast failed') || lower.includes('geocoding failed')) {
    return 'http';
  }
  if (lower.includes('missing current') || lower.includes('missing daily')) {
    return 'invalid';
  }
  return 'unknown';
}

export function weatherErrorMessage(kind: WeatherFetchFailureKind): string {
  switch (kind) {
    case 'offline':
      return i18n.t('home:weatherErrors.offline');
    case 'http':
      return i18n.t('home:weatherErrors.http');
    case 'invalid':
      return i18n.t('home:weatherErrors.invalid');
    default:
      return i18n.t('home:weatherErrors.unknown');
  }
}
