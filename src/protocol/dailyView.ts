import type { ElementDefinition } from './element';
import type { HabitConfig } from './kinds/habit';
import { HabitConfigSchema, isHabitScheduledOnDate, isHabitStartingSoon, shouldShowHabitOnHabitsPage } from './kinds/habit';
import { toDateString } from './event';

export const DAILY_VIEW_FILTERS = [
  'all_due',
  'undone',
  'starting_soon',
  'all',
] as const;

export type DailyViewFilter = (typeof DAILY_VIEW_FILTERS)[number];

export const DAILY_VIEW_FILTER_LABELS: Record<DailyViewFilter, string> = {
  all_due: 'Due today',
  undone: 'Undone',
  starting_soon: 'Starting soon',
  all: 'All habits',
};

export function isDailyViewFilter(value: string): value is DailyViewFilter {
  return (DAILY_VIEW_FILTERS as readonly string[]).includes(value);
}

export interface DailyHabitFilterContext {
  now: Date;
  today: string;
  habitDoneToday: Record<string, boolean>;
  withinHours?: number;
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

export function filterHabitsForDailyView(
  habits: ElementDefinition[],
  filter: DailyViewFilter,
  context: DailyHabitFilterContext,
): ElementDefinition[] {
  const withinHours = context.withinHours ?? 2;

  return habits.filter((habit) => {
    const config = HabitConfigSchema.parse(habit.config);

    if (filter === 'all') {
      return shouldShowHabitOnHabitsPage(config, context.now);
    }

    if (!isHabitDueToday(config, context)) {
      return false;
    }

    if (filter === 'undone') {
      return !(context.habitDoneToday[habit.id] ?? false);
    }

    if (filter === 'starting_soon') {
      return isHabitStartingSoon(config, context.now, withinHours);
    }

    return true;
  });
}

export function defaultDailyFilterContext(now = new Date()): DailyHabitFilterContext {
  return {
    now,
    today: toDateString(now),
    habitDoneToday: {},
  };
}
