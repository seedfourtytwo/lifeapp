import {
  countTodosNeedingAttention,
  dayOutcome,
  factsFromTotal,
  isHabitDueToday,
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

    switch (element.kind) {
      case 'habit':
        if (isHabitDueToday(element.config, { now, today }) && !args.habitDoneToday[element.id]) {
          habits += 1;
        }
        break;
      case 'counter':
        // A counter with no daily target is never "unfinished": there is nothing to finish.
        if (
          dayOutcome(element, factsFromTotal(args.dailyTotals[element.id] ?? 0)).reason ===
          'under_target'
        ) {
          counters += 1;
        }
        break;
      default: {
        const unknown: never = element;
        throw new Error(`Unknown tracker kind: ${JSON.stringify(unknown)}`);
      }
    }
  }

  const todos = countTodosNeedingAttention(args.todos ?? [], today);

  return { habits, counters, todos, total: habits + counters + todos };
}
