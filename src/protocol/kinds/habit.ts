import { z } from 'zod';
import { isWithinTimeRange, formatTimeRange } from '../../utils/time';

export const HabitTimeSlotSchema = z.enum([
  'morning',
  'afternoon',
  'evening',
  'anytime',
]);

export type HabitTimeSlot = z.infer<typeof HabitTimeSlotSchema>;

const HabitTimeHHmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const HabitTimeRangeSchema = z.object({
  start: HabitTimeHHmmSchema,
  end: HabitTimeHHmmSchema,
});

export type HabitTimeRange = z.infer<typeof HabitTimeRangeSchema>;

export const HabitConfigSchema = z.object({
  timeSlot: HabitTimeSlotSchema,
  /** Display-only target, e.g. "15 min", "1 cup" */
  targetLabel: z.string().optional(),
  /** Optional daily window, e.g. 06:00–09:00 */
  timeRange: HabitTimeRangeSchema.optional(),
  /** When true, habit is hidden on the Habits tab outside timeRange */
  visibleOnlyInTimeRange: z.boolean().optional(),
});

export type HabitConfig = z.infer<typeof HabitConfigSchema>;

export const DEFAULT_HABIT_CONFIG: HabitConfig = {
  timeSlot: 'anytime',
};

export const HABIT_TIME_SLOT_LABELS: Record<HabitTimeSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

export const HABIT_TIME_SLOT_ORDER: HabitTimeSlot[] = [
  'morning',
  'afternoon',
  'evening',
  'anytime',
];

export type HabitInput = {
  name: string;
  timeSlot: HabitTimeSlot;
  targetLabel?: string;
  timeRange?: HabitTimeRange;
  visibleOnlyInTimeRange?: boolean;
};

export function buildHabitConfig(input: {
  timeSlot: HabitTimeSlot;
  targetLabel?: string;
  timeRange?: HabitTimeRange;
  visibleOnlyInTimeRange?: boolean;
}): HabitConfig {
  return {
    timeSlot: input.timeSlot,
    ...(input.targetLabel?.trim() ? { targetLabel: input.targetLabel.trim() } : {}),
    ...(input.timeRange ? { timeRange: input.timeRange } : {}),
    ...(input.visibleOnlyInTimeRange ? { visibleOnlyInTimeRange: true } : {}),
  };
}

export function shouldShowHabitOnHabitsPage(config: HabitConfig, now = new Date()): boolean {
  if (!config.visibleOnlyInTimeRange || !config.timeRange) {
    return true;
  }
  return isWithinTimeRange(now, config.timeRange.start, config.timeRange.end);
}

export function formatHabitDescription(config: HabitConfig): string | undefined {
  const parts: string[] = [];
  if (config.targetLabel) {
    parts.push(config.targetLabel);
  }
  if (config.timeRange) {
    const range = formatTimeRange(config.timeRange.start, config.timeRange.end);
    parts.push(config.visibleOnlyInTimeRange ? `${range} (scheduled)` : range);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
