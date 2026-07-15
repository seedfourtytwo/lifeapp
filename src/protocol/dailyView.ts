import type { ElementDefinition } from './element';
import type { HabitConfig, HabitTimeSlot } from './kinds/habit';
import {
  HabitConfigSchema,
  HABIT_TIME_SLOT_ORDER,
  isHabitScheduledOnDate,
  shouldShowHabitOnHabitsPage,
} from './kinds/habit';

/**
 * Daily tab view filter.
 * Habit order is independent (`dashboard_items.sort_order`); filters only hide rows.
 */
export const DAILY_VIEW_FILTERS = [
  'all',
  'remaining',
  'morning',
  'afternoon',
  'evening',
  'anytime',
  'everything',
] as const;

export type DailyViewFilter = (typeof DAILY_VIEW_FILTERS)[number];

export const DAILY_VIEW_FILTER_LABELS: Record<DailyViewFilter, string> = {
  all: 'All today',
  remaining: 'Remaining',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
  everything: 'Everything',
};

/** View used while the user is rearranging habits (shows the full due-today set). */
export const DAILY_REORDER_VIEW: DailyViewFilter = 'all';

const TIME_SLOT_FILTERS = new Set<DailyViewFilter>([
  'morning',
  'afternoon',
  'evening',
  'anytime',
]);

const LEGACY_DAILY_VIEW_FILTERS: Record<string, DailyViewFilter> = {
  all_due: 'all',
  undone: 'remaining',
  starting_soon: 'remaining',
  all_habits: 'everything',
};

export function isDailyViewFilter(value: string): value is DailyViewFilter {
  return (DAILY_VIEW_FILTERS as readonly string[]).includes(value);
}

/** Map stored / backup values onto the current filter enum. */
export function migrateDailyViewFilter(value: string | null | undefined): DailyViewFilter | null {
  if (!value) return null;
  if (isDailyViewFilter(value)) return value;
  return LEGACY_DAILY_VIEW_FILTERS[value] ?? null;
}

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

export function filterHabitsForDailyView(
  habits: ElementDefinition[],
  filter: DailyViewFilter,
  context: DailyHabitFilterContext,
): ElementDefinition[] {
  return habits.filter((habit) => {
    const config = HabitConfigSchema.parse(habit.config);

    if (filter === 'everything') {
      return shouldShowHabitOnHabitsPage(config, context.now);
    }

    if (!isHabitDueToday(config, context)) {
      return false;
    }

    if (filter === 'remaining') {
      return !(context.habitDoneToday[habit.id] ?? false);
    }

    if (TIME_SLOT_FILTERS.has(filter)) {
      return config.timeSlot === filter;
    }

    return true;
  });
}

/** Views that show multiple time-of-day section headers. */
export function dailyViewUsesSlotSections(filter: DailyViewFilter): boolean {
  return filter === 'all' || filter === 'remaining' || filter === 'everything';
}

export type DailyHabitSection = {
  slot: HabitTimeSlot | null;
  items: ElementDefinition[];
};

/** Group already-filtered habits for Daily list rendering. */
export function groupHabitsForDailyView(
  habits: ElementDefinition[],
  filter: DailyViewFilter,
  configs: Map<string, HabitConfig>,
): DailyHabitSection[] {
  if (!dailyViewUsesSlotSections(filter)) {
    return [{ slot: null, items: habits }];
  }

  return HABIT_TIME_SLOT_ORDER.map((slot) => ({
    slot,
    items: habits.filter((habit) => configs.get(habit.id)?.timeSlot === slot),
  })).filter((group) => group.items.length > 0);
}
