import {
  CounterConfigSchema,
  countTodosNeedingAttention,
  isHabitDueToday,
  parseHabitConfig,
  toDateString,
  type ElementDefinition,
  type Todo,
} from '../protocol';
import { isElementArchived } from '../utils/dashboardElements';

export type UnfinishedTrackerCounts = {
  habits: number;
  counters: number;
  /** Open todos due today or already past their deadline. Undated ones never count. */
  todos: number;
  total: number;
};

/**
 * Count what is still open today: due habits not done, counters under their
 * daily target, and todos due today or overdue.
 */
export function countUnfinishedTrackersToday(args: {
  elements: ElementDefinition[];
  habitDoneToday: Record<string, boolean>;
  dailyTotals: Record<string, number>;
  todos?: readonly Todo[];
  now?: Date;
}): UnfinishedTrackerCounts {
  const now = args.now ?? new Date();
  const today = toDateString(now);

  let habits = 0;
  let counters = 0;

  for (const element of args.elements) {
    if (isElementArchived(element)) continue;

    if (element.kind === 'habit') {
      const config = parseHabitConfig(element.config);
      if (!isHabitDueToday(config, { now, today })) continue;
      if (!(args.habitDoneToday[element.id] ?? false)) {
        habits += 1;
      }
      continue;
    }

    if (element.kind === 'counter') {
      const config = CounterConfigSchema.parse(element.config);
      if (!config.dailyTarget || config.dailyTarget <= 0) continue;
      const total = args.dailyTotals[element.id] ?? 0;
      if (total < config.dailyTarget) {
        counters += 1;
      }
    }
  }

  const todos = countTodosNeedingAttention(args.todos ?? [], today);

  return { habits, counters, todos, total: habits + counters + todos };
}
