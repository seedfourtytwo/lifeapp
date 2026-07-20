import type { ElementDefinition } from './element';
import type { HabitConfig, HabitTimeSlot } from './kinds/habit';
import {
  HabitConfigSchema,
  isHabitScheduledOnDate,
  shouldShowHabitOnHabitsPage,
} from './kinds/habit';

export interface DailyHabitFilterContext {
  now: Date;
  today: string;
  habitDoneToday: Record<string, boolean>;
}

export function isHabitDueToday(
  config: HabitConfig,
  context: Pick<DailyHabitFilterContext, 'now' | 'today'>,
): boolean {
  return (
    isHabitScheduledOnDate(config, context.today) &&
    shouldShowHabitOnHabitsPage(config, context.now)
  );
}

/** Habits due today, in dashboard sort_order (caller supplies already-sorted active habits). */
export function filterHabitsDueToday(
  habits: ElementDefinition[],
  context: DailyHabitFilterContext,
): ElementDefinition[] {
  return habits.filter((habit) => {
    const config = HabitConfigSchema.parse(habit.config);
    return isHabitDueToday(config, context);
  });
}

/**
 * Daily list order: remaining first (user sort_order), then done (user sort_order).
 * Keeps completed habits visible without a filter.
 */
export function orderHabitsForDailyList(
  habits: ElementDefinition[],
  habitDoneToday: Record<string, boolean>,
): ElementDefinition[] {
  const remaining: ElementDefinition[] = [];
  const done: ElementDefinition[] = [];
  for (const habit of habits) {
    if (habitDoneToday[habit.id]) {
      done.push(habit);
    } else {
      remaining.push(habit);
    }
  }
  return [...remaining, ...done];
}

/** Quiet part-of-day cue on Daily cards — not a list structure. */
export function habitTimeHintLabel(timeSlot: HabitTimeSlot): string | null {
  switch (timeSlot) {
    case 'morning':
      return 'AM';
    case 'afternoon':
      return 'Lunch';
    case 'evening':
      return 'PM';
    case 'anytime':
      return null;
  }
}

// --- Legacy filter ids (older backups / settings rows) -----------------

/** @deprecated Kept so older backups still parse; Daily no longer uses filters. */
export const DAILY_VIEW_FILTERS = [
  'all',
  'remaining',
  'morning',
  'afternoon',
  'evening',
  'anytime',
  'everything',
] as const;

/** @deprecated */
export type DailyViewFilter = (typeof DAILY_VIEW_FILTERS)[number];

/** @deprecated */
export const DAILY_ARRANGE_MODES = ['order', 'time'] as const;

/** @deprecated */
export type DailyArrangeMode = (typeof DAILY_ARRANGE_MODES)[number];

const LEGACY_DAILY_VIEW_FILTERS: Record<string, DailyViewFilter> = {
  all_due: 'all',
  undone: 'remaining',
  starting_soon: 'remaining',
  all_habits: 'everything',
};

export function isDailyViewFilter(value: string): value is DailyViewFilter {
  return (DAILY_VIEW_FILTERS as readonly string[]).includes(value);
}

export function isDailyArrangeMode(value: string): value is DailyArrangeMode {
  return (DAILY_ARRANGE_MODES as readonly string[]).includes(value);
}

export function migrateDailyViewFilter(value: string | null | undefined): DailyViewFilter | null {
  if (!value) return null;
  if (isDailyViewFilter(value)) return value;
  return LEGACY_DAILY_VIEW_FILTERS[value] ?? null;
}
