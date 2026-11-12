import type { ResolvedLanguage } from '../i18n/types';
import type { ElementDefinition } from '../protocol';
import {
  REMINDER_PLAN_VERSION,
  type ReminderPlan,
  type ReminderPlanHabit,
} from '../protocol/reminderPlan';
import { isElementArchived } from '../utils/dashboardElements';
import { habitReminderClockTimes } from './habitStartReminderTimes';

/** The plan the native scheduler reminds from: every live habit with a reminder time. */
export function buildReminderPlan(input: {
  elements: readonly ElementDefinition[];
  enabled: boolean;
  language: ResolvedLanguage;
}): ReminderPlan {
  const habits = input.elements.flatMap((element): ReminderPlanHabit[] => {
    if (element.kind !== 'habit' || isElementArchived(element)) return [];
    const reminderTimes = habitReminderClockTimes(element.config);
    if (reminderTimes.length === 0) return [];
    return [
      {
        id: element.id,
        name: element.name,
        lockScreenName: element.config.lockScreenName ?? null,
        schedule: element.config.schedule,
        reminderTimes,
      },
    ];
  });
  return {
    version: REMINDER_PLAN_VERSION,
    enabled: input.enabled,
    language: input.language,
    habits,
  };
}
