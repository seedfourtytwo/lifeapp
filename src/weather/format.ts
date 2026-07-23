import { getDateLocale } from '../i18n';

/** Shared weather display helpers. */

export function formatTempC(tempC: number): string {
  return `${Math.round(tempC)}°`;
}

/** Zero-padded DD/MM for the weather chip face. */
export function formatBubbleDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/** Zero-padded DD/MM from an ISO calendar date (`YYYY-MM-DD`). */
export function formatBubbleDateFromIso(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return formatBubbleDate(d);
}

/** Short weekday for forecast chips (e.g. Mon / lun.). */
export function formatWeekdayShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(getDateLocale(), { weekday: 'short' });
}

export function formatCoordLabel(lat: number, lon: number): string {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}
