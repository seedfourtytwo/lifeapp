import type { HabitElement } from './element';
import type { HabitConfig } from './kinds/habit';
import {
  isHabitScheduledOnDate,
  shouldShowHabitOnHabitsPage,
} from './kinds/habit';

export interface HabitListFilterContext {
  now: Date;
  today: string;
  habitDoneToday: Record<string, boolean>;
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

/** Habits due today, in dashboard sort_order (caller supplies already-sorted active habits). */
export function filterHabitsDueToday(
  habits: HabitElement[],
  context: HabitListFilterContext,
): HabitElement[] {
  return habits.filter((habit) => isHabitDueToday(habit.config, context));
}

/**
 * Habits list order: remaining first (user sort_order), then done (user sort_order).
 * Keeps completed habits visible without a filter.
 */
export function orderHabitsList<T extends { id: string }>(
  habits: T[],
  habitDoneToday: Record<string, boolean>,
): T[] {
  const remaining: T[] = [];
  const done: T[] = [];
  for (const habit of habits) {
    if (habitDoneToday[habit.id]) {
      done.push(habit);
    } else {
      remaining.push(habit);
    }
  }
  return [...remaining, ...done];
}
