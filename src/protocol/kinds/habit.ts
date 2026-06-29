import { z } from 'zod';
import { isWithinTimeRange, formatTimeRange } from '../../utils/time';
import {
  formatScheduleDescription,
  HabitScheduleSchema,
  isScheduleActiveOnDate,
  isTimeRangeStartingSoon,
  type HabitSchedule,
} from '../schedule';

export { HabitScheduleSchema, type HabitSchedule, formatScheduleDescription };

export const HabitTrackingModeSchema = z.enum(['boolean', 'timer']);

export type HabitTrackingMode = z.infer<typeof HabitTrackingModeSchema>;

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
  trackingMode: HabitTrackingModeSchema.default('boolean'),
  timeSlot: HabitTimeSlotSchema,
  schedule: HabitScheduleSchema.default({ type: 'daily' }),
  targetLabel: z.string().optional(),
  timeRange: HabitTimeRangeSchema.optional(),
  visibleOnlyInTimeRange: z.boolean().optional(),
  /** Timer goal in seconds — drives progress bar and streak completion */
  dailyTargetSeconds: z.number().int().positive().optional(),
  /** Reference into the user's sound library */
  soundId: z.string().uuid().optional(),
  /** Minutes before timeRange.start to fire a local reminder */
  remindMinutesBefore: z.number().int().nonnegative().optional(),
});

export type HabitConfig = z.infer<typeof HabitConfigSchema>;

export const HabitEventMetaSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('habit_tick') }),
  z.object({
    source: z.literal('timer_session'),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    durationSeconds: z.number().nonnegative(),
  }),
]);

export type HabitEventMeta = z.infer<typeof HabitEventMetaSchema>;

export const DEFAULT_HABIT_CONFIG: HabitConfig = {
  trackingMode: 'boolean',
  timeSlot: 'anytime',
  schedule: { type: 'daily' },
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
  trackingMode?: HabitTrackingMode;
  timeSlot: HabitTimeSlot;
  targetLabel?: string;
  timeRange?: HabitTimeRange;
  visibleOnlyInTimeRange?: boolean;
  dailyTargetSeconds?: number;
  soundId?: string;
  schedule?: HabitSchedule;
  remindMinutesBefore?: number;
};

export function buildHabitConfig(input: {
  trackingMode?: HabitTrackingMode;
  timeSlot: HabitTimeSlot;
  targetLabel?: string;
  timeRange?: HabitTimeRange;
  visibleOnlyInTimeRange?: boolean;
  dailyTargetSeconds?: number;
  soundId?: string;
  schedule?: HabitSchedule;
  remindMinutesBefore?: number;
}): HabitConfig {
  return {
    trackingMode: input.trackingMode ?? 'boolean',
    timeSlot: input.timeSlot,
    schedule: input.schedule ?? { type: 'daily' },
    ...(input.targetLabel?.trim() ? { targetLabel: input.targetLabel.trim() } : {}),
    ...(input.timeRange ? { timeRange: input.timeRange } : {}),
    ...(input.visibleOnlyInTimeRange ? { visibleOnlyInTimeRange: true } : {}),
    ...(input.trackingMode === 'timer' &&
    input.dailyTargetSeconds &&
    input.dailyTargetSeconds > 0
      ? { dailyTargetSeconds: input.dailyTargetSeconds }
      : {}),
    ...(input.soundId ? { soundId: input.soundId } : {}),
    ...(input.remindMinutesBefore !== undefined && input.remindMinutesBefore >= 0
      ? { remindMinutesBefore: input.remindMinutesBefore }
      : {}),
  };
}

export function isHabitDayComplete(total: number, config: HabitConfig): boolean {
  if (config.trackingMode === 'timer') {
    if (config.dailyTargetSeconds && config.dailyTargetSeconds > 0) {
      return total >= config.dailyTargetSeconds;
    }
    return total > 0;
  }
  return total >= 1;
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

export function isHabitScheduledOnDate(config: HabitConfig, dateStr: string): boolean {
  return isScheduleActiveOnDate(config.schedule, dateStr);
}

export function isHabitStartingSoon(
  config: HabitConfig,
  now = new Date(),
  withinHours = 2,
): boolean {
  return isTimeRangeStartingSoon(config.timeRange, now, withinHours);
}

export function formatHabitTimerDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function timerSessionDurationSeconds(startedAt: Date, endedAt: Date): number {
  return Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
}

export function buildTimerSessionPayload(
  startedAt: Date,
  endedAt: Date,
): { value: number; meta: Extract<HabitEventMeta, { source: 'timer_session' }> } {
  const durationSeconds = timerSessionDurationSeconds(startedAt, endedAt);
  return {
    value: durationSeconds,
    meta: {
      source: 'timer_session',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds,
    },
  };
}

export function liveTimerTotalSeconds(
  loggedTotalSeconds: number,
  activeSession: { startedAt: string } | null | undefined,
  nowMs = Date.now(),
): number {
  if (!activeSession) {
    return loggedTotalSeconds;
  }
  const elapsed = Math.floor((nowMs - new Date(activeSession.startedAt).getTime()) / 1000);
  return loggedTotalSeconds + Math.max(0, elapsed);
}
