import { getDateLocale } from '../i18n';

/** Shared weather display helpers (bubble + sheet). */

export function formatTempC(tempC: number): string {
  return `${Math.round(tempC)}°`;
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(getDateLocale(), { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatCoordLabel(lat: number, lon: number): string {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}
