import { getDateLocale } from '../i18n';
import { parseLocalDate } from '../protocol';

/** Shared weather display helpers. */

export function formatTempC(tempC: number): string {
  return `${Math.round(tempC)}°`;
}

/** Short weekday for forecast chips (e.g. Mon / lun.). */
export function formatWeekdayShort(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(getDateLocale(), { weekday: 'short' });
}

export function formatCoordLabel(lat: number, lon: number): string {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}
