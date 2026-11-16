import type { ElementDefinition } from './element';
import type { HabitConfig } from './kinds/habit';
import {
  HabitConfigSchema,
  isHabitScheduledOnDate,
  shouldShowHabitOnHabitsPage,
} from './kinds/habit';

export interface HabitListFilterContext {
  now: Date;
  today: string;
  /** Unused by the due-today filter; kept so existing callers still type-check. */
  habitDoneToday?: Record<string, boolean>;
}

export function isHabitDueToday(
  config: HabitConfig,
  context: Pick<HabitListFilterContext, 'now' | 'today'>,
): boolean {
  return (
    isHabitScheduledOnDate(config, context.today) &&
    shouldShowHabitOnHabitsPage(config, context.now)
  );
}

/**
 * Habits due today, in dashboard sort_order (caller supplies already-sorted active habits).
 * Pass `parsedConfigs` when the caller already parsed them, to skip a Zod parse per habit.
 */
export function filterHabitsDueToday(
  habits: ElementDefinition[],
  context: HabitListFilterContext,
  parsedConfigs?: ReadonlyMap<string, HabitConfig>,
): ElementDefinition[] {
  return habits.filter((habit) => {
    const config = parsedConfigs?.get(habit.id) ?? HabitConfigSchema.parse(habit.config);
    return isHabitDueToday(config, context);
  });
}

/**
 * Habits list order: remaining first (user sort_order), then done (user sort_order).
 * Keeps completed habits visible without a filter.
 */
export function orderHabitsList(
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
