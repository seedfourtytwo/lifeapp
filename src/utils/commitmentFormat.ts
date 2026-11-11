import { i18n } from '../i18n';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Time clear as a short clock: "42m" under an hour, "5h 12m" under a day,
 * "2d 14h" after that. Always rounded down, and never below zero (a clock
 * set back before clear-since reads "0m").
 */
export function formatTimeClear(elapsedMs: number): string {
  const ms = Math.max(0, elapsedMs);
  if (ms < HOUR_MS) {
    return i18n.t('trackers:commitment.clearMinutes', { minutes: Math.floor(ms / MINUTE_MS) });
  }
  if (ms < DAY_MS) {
    return i18n.t('trackers:commitment.clearHoursMinutes', {
      hours: Math.floor(ms / HOUR_MS),
      minutes: Math.floor((ms % HOUR_MS) / MINUTE_MS),
    });
  }
  return i18n.t('trackers:commitment.clearDaysHours', {
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor((ms % DAY_MS) / HOUR_MS),
  });
}

/** A lamp's short name: "24h" and "48h", then whole days ("3d", "21d"). */
export function formatLampLabel(hours: number): string {
  return hours < 72
    ? i18n.t('trackers:commitment.lampHours', { count: hours })
    : i18n.t('trackers:commitment.lampDays', { count: Math.round(hours / 24) });
}
