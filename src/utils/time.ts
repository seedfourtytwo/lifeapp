const TIME_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse flexible input (6:30, 0630, 06:30) into HH:mm, or null if invalid. */
export function parseTimeHHmm(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\d{3,4}$/.test(trimmed)) {
    const padded = trimmed.padStart(4, '0');
    normalized = `${padded.slice(0, -2)}:${padded.slice(-2)}`;
  } else if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    normalized = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }

  return TIME_HHMM.test(normalized) ? normalized : null;
}

export function timeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Inclusive start, exclusive end. Supports ranges that wrap past midnight. */
export function isWithinTimeRange(now: Date, start: string, end: string): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes <= endMinutes) {
    return current >= startMinutes && current < endMinutes;
  }

  return current >= startMinutes || current < endMinutes;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start}–${end}`;
}
