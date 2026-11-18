import type { ElementDefinition } from './element';
import type { HabitConfig } from './kinds/habit';
import { HabitConfigSchema, shouldShowHabitOnHabitsPage } from './kinds/habit';
import { isScheduleDueOnDate } from './schedule';

export interface HabitListFilterContext {
  now: Date;
  today: string;
  /** Today's completion per habit — a `times_per_week` habit stays listed once done. */
  habitDoneToday?: Record<string, boolean>;
  /** `times_per_week` habits: this week's completed dates before `today`. */
  habitWeekDoneBefore?: Record<string, readonly string[]>;
  /** Today holds a skip row; skipped = skip row and not done (see `dayRules.ts`). */
  skipRowToday?: Record<string, boolean>;
  /**
   * Keep skipped habits in the result. Home does — a skipped row stays listed,
   * sunk with the done ones, so it can be undone. Everything that asks "is it
   * still to do" (reminders, check-in, lock screen) leaves it out.
   */
  includeSkipped?: boolean;
}

/** What one habit's today looks like, for the due rule. */
export interface HabitTodayFacts {
  doneToday?: boolean;
  /** `times_per_week`: this week's completed dates before today. */
  weekDoneBefore?: readonly string[];
  /** Today holds a skip row. */
  skipRow?: boolean;
}

function completedSoFar(today: string, facts: HabitTodayFacts): Set<string> {
  const completed = new Set(facts.weekDoneBefore ?? []);
  if (facts.doneToday) completed.add(today);
  return completed;
}

/**
 * Offered today, ignoring skips: scheduled (for `times_per_week`, the week's
 * target is not yet met by earlier days, or today is done) and inside its
 * visibility window. Without `facts` a `times_per_week` habit reads as offered.
 */
export function isHabitOfferedToday(
  config: HabitConfig,
  context: Pick<HabitListFilterContext, 'now' | 'today'>,
  facts: HabitTodayFacts = {},
): boolean {
  return (
    isScheduleDueOnDate(config.schedule, context.today, completedSoFar(context.today, facts)) &&
    shouldShowHabitOnHabitsPage(config, context.now)
  );
}

/** Due today: offered and not skipped (a done habit is still due — it stays visible). */
export function isHabitDueToday(
  config: HabitConfig,
  context: Pick<HabitListFilterContext, 'now' | 'today'>,
  facts: HabitTodayFacts = {},
): boolean {
  const skipped = Boolean(facts.skipRow) && !facts.doneToday;
  return !skipped && isHabitOfferedToday(config, context, facts);
}

export function habitTodayFacts(
  habitId: string,
  context: Pick<HabitListFilterContext, 'habitDoneToday' | 'habitWeekDoneBefore' | 'skipRowToday'>,
): HabitTodayFacts {
  return {
    doneToday: context.habitDoneToday?.[habitId] ?? false,
    weekDoneBefore: context.habitWeekDoneBefore?.[habitId],
    skipRow: context.skipRowToday?.[habitId] ?? false,
  };
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
    const facts = habitTodayFacts(habit.id, context);
    return context.includeSkipped
      ? isHabitOfferedToday(config, context, facts)
      : isHabitDueToday(config, context, facts);
  });
}

/**
 * Habits list order: remaining first (user sort_order), then done and skipped
 * (user sort_order). Keeps completed habits visible without a filter.
 */
export function orderHabitsList(
  habits: ElementDefinition[],
  habitDoneToday: Record<string, boolean>,
  skippedToday: Record<string, boolean> = {},
): ElementDefinition[] {
  const remaining: ElementDefinition[] = [];
  const settled: ElementDefinition[] = [];
  for (const habit of habits) {
    if (habitDoneToday[habit.id] || skippedToday[habit.id]) {
      settled.push(habit);
    } else {
      remaining.push(habit);
    }
  }
  return [...remaining, ...settled];
}
