import type { ElementDefinition } from './element';
import type { HabitConfig, HabitTimeSlot } from './kinds/habit';
import {
  HabitConfigSchema,
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
  habits: ElementDefinition[],
  context: HabitListFilterContext,
): ElementDefinition[] {
  return habits.filter((habit) => {
    const config = HabitConfigSchema.parse(habit.config);
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

/** Quiet part-of-day cue on habit cards — not a list structure. */
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
