import { normalizeReminderTimes } from '../protocol';
import { parseTimeHHmm } from './time';

/**
 * The list with a typed time added (8:00, 0800 and 08:00 all read as 08:00),
 * kept once each in clock order; null when what was typed is not a time.
 */
export function withReminderTime(times: readonly string[], typed: string): string[] | null {
  const time = parseTimeHHmm(typed);
  return time ? normalizeReminderTimes([...times, time]) : null;
}
