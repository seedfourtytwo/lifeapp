import type { TFunction } from 'i18next';
import { formatTimeRange, parseTimeHHmm } from '../../utils/time';
import type { HabitEditorFieldState } from './types';

type TimeOfDayState = Pick<
  HabitEditorFieldState,
  | 'useTimeRange'
  | 'timeRangeStart'
  | 'timeRangeEnd'
  | 'visibleOnlyInTimeRange'
  | 'useReminder'
  | 'remindMinutesBefore'
>;

/**
 * What the closed "Time of day" row says it is set to: the range, then each
 * thing switched on inside the section — "07:00–09:00, reminder 10 min before".
 * Only what would actually be saved is listed, so a half-typed range or an
 * unreadable reminder reads as not set.
 */
export function timeOfDaySummary(state: TimeOfDayState, t: TFunction): string {
  const start = state.useTimeRange ? parseTimeHHmm(state.timeRangeStart) : null;
  const end = state.useTimeRange ? parseTimeHHmm(state.timeRangeEnd) : null;
  if (!start || !end) return t('habitFields.timeOfDayAny');

  const parts = [formatTimeRange(start, end)];
  if (state.visibleOnlyInTimeRange) parts.push(t('habitFields.timeOfDayHiddenOutside'));

  const minutes = state.useReminder ? parseInt(state.remindMinutesBefore.trim(), 10) : Number.NaN;
  if (minutes === 0) parts.push(t('habitFields.timeOfDayReminderAtStart'));
  else if (minutes > 0) parts.push(t('habitFields.timeOfDayReminder', { count: minutes }));

  return parts.join(', ');
}
