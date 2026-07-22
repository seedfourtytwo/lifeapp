import { i18n } from '../i18n';
import { toDateString } from '../protocol/event';

/** How far back to wipe protocol activity (habit/counter events). */
export type ActivityClearPeriod =
  | { kind: 'all' }
  | { kind: 'keepLastDays'; days: 7 | 30 }
  | { kind: 'beforeDate'; date: string };

export interface ClearAppDataOptions {
  /** Habit check-offs, timer sessions, counter logs, day notes, daily journals. */
  activityHistory: boolean;
  activityPeriod: ActivityClearPeriod;
  calendar: boolean;
  weather: boolean;
  preferences: boolean;
  /** Habits, counters, and dashboard order. Implies full activity wipe (FK cascade). */
  definitions: boolean;
}

export const DEFAULT_CLEAR_OPTIONS: ClearAppDataOptions = {
  activityHistory: true,
  activityPeriod: { kind: 'all' },
  calendar: false,
  weather: false,
  preferences: false,
  definitions: false,
};

/**
 * Upper exclusive bound for `DELETE … WHERE date < cutoff`.
 * `null` means delete every activity event.
 */
export function resolveActivityDeleteBeforeDate(
  period: ActivityClearPeriod,
  today: Date = new Date(),
): string | null {
  if (period.kind === 'all') return null;

  if (period.kind === 'keepLastDays') {
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    cutoff.setDate(cutoff.getDate() - (period.days - 1));
    return toDateString(cutoff);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.date)) {
    throw new Error('Before date must be YYYY-MM-DD');
  }
  return period.date;
}

export function clearOptionsAreEmpty(options: ClearAppDataOptions): boolean {
  return (
    !options.activityHistory &&
    !options.calendar &&
    !options.weather &&
    !options.preferences &&
    !options.definitions
  );
}

/** Human-readable lines for the confirm dialog. */
export function describeClearPlan(
  options: ClearAppDataOptions,
  today: Date = new Date(),
): string[] {
  const lines: string[] = [];

  if (options.definitions) {
    lines.push(i18n.t('settings:clearData.plan.definitions'));
    lines.push(i18n.t('settings:clearData.plan.definitionsActivity'));
  } else if (options.activityHistory) {
    if (options.activityPeriod.kind === 'beforeDate') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(options.activityPeriod.date)) {
        lines.push(i18n.t('settings:clearData.plan.activityBeforeUnset'));
      } else {
        lines.push(
          i18n.t('settings:clearData.plan.activityBefore', {
            date: options.activityPeriod.date,
          }),
        );
      }
    } else if (options.activityPeriod.kind === 'keepLastDays') {
      const cutoff = resolveActivityDeleteBeforeDate(options.activityPeriod, today);
      lines.push(
        i18n.t('settings:clearData.plan.activityKeepLast', {
          days: options.activityPeriod.days,
          cutoff,
        }),
      );
    } else {
      lines.push(i18n.t('settings:clearData.plan.activityAll'));
    }
  }

  if (options.calendar) {
    lines.push(i18n.t('settings:clearData.plan.calendar'));
  }
  if (options.weather) {
    lines.push(i18n.t('settings:clearData.plan.weather'));
  }
  if (options.preferences) {
    lines.push(i18n.t('settings:clearData.plan.preferences'));
  }

  return lines;
}
