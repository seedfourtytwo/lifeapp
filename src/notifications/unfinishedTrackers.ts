import {
  CounterConfigSchema,
  isHabitDueToday,
  parseHabitConfig,
  toDateString,
  type ElementDefinition,
} from '../protocol';
import { isElementArchived } from '../utils/dashboardElements';

export type UnfinishedTrackerCounts = {
  habits: number;
  counters: number;
  total: number;
};

/** Count due habits not done and counters still under their daily target. */
export function countUnfinishedTrackersToday(args: {
  elements: ElementDefinition[];
  habitDoneToday: Record<string, boolean>;
  dailyTotals: Record<string, number>;
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

  return { habits, counters, total: habits + counters };
}
