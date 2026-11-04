import { parseLocalDate, shiftDateString } from '../../protocol';

export type DueChip = 'none' | 'today' | 'tomorrow' | 'weekend' | 'nextWeek' | 'custom';

export interface DueChipDates {
  today: string;
  tomorrow: string;
  /** The coming Saturday; today itself on a Saturday or Sunday. */
  weekend: string;
  /** The next Monday, never today. */
  nextWeek: string;
}

/** The deadlines the one-tap chips stand for, worked out from `today`. */
export function dueChipDates(today: string): DueChipDates {
  const weekday = parseLocalDate(today).getDay(); // 0 = Sunday
  const toSaturday = weekday === 0 ? 0 : 6 - weekday;
  const toMonday = weekday === 0 ? 1 : 8 - weekday;
  return {
    today,
    tomorrow: shiftDateString(today, 1),
    weekend: shiftDateString(today, toSaturday),
    nextWeek: shiftDateString(today, toMonday),
  };
}

const ORDER = ['today', 'tomorrow', 'weekend', 'nextWeek'] as const;

/** Which chip a saved deadline shows as; the first chip with that date wins. */
export function matchDueChip(dueDate: string | null, today: string): DueChip {
  if (dueDate == null) return 'none';
  const dates = dueChipDates(today);
  return ORDER.find((chip) => dates[chip] === dueDate) ?? 'custom';
}
