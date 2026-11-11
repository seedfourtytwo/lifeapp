import { z } from 'zod';
import { i18n } from '../../i18n';
import { isWithinTimeRange, formatTimeRange } from '../../utils/time';
import {
  formatScheduleDescription,
  HabitScheduleSchema,
  isScheduleActiveOnDate,
  isTimeRangeStartingSoon,
  type HabitSchedule,
} from '../schedule';
import { HabitTimerSoundSchema, type HabitTimerSound } from '../habitSound';
import {
  type ActiveTimerSession,
  activeTimerElapsedSeconds,
} from '../activeTimerSession';
import {
  OptionalTrackerIconSchema,
  type TrackerIconId,
} from '../trackerIcons';

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

/** One entry per time, earliest first — HH:mm sorts as text. */
export function normalizeReminderTimes(times: readonly string[]): string[] {
  return [...new Set(times)].sort();
}

/** Longest lock-screen name kept; a locked phone has room for a word or two. */
export const LOCK_SCREEN_NAME_MAX = 20;

/** Trimmed and cut to fit, or undefined when nothing is left. */
export function normalizeLockScreenName(name: string | undefined): string | undefined {
  const trimmed = name?.trim().slice(0, LOCK_SCREEN_NAME_MAX).trim();
  return trimmed ? trimmed : undefined;
}

export const HabitConfigSchema = z.object({
  trackingMode: HabitTrackingModeSchema.default('boolean'),
  timeSlot: HabitTimeSlotSchema.default('anytime'),
  schedule: HabitScheduleSchema.default({ type: 'daily' }),
  targetLabel: z.string().optional(),
  timeRange: HabitTimeRangeSchema.optional(),
  visibleOnlyInTimeRange: z.boolean().optional(),
  /** Timer goal in seconds — drives progress bar and streak completion */
  dailyTargetSeconds: z.number().int().positive().optional(),
  /** Bundled audio track while the timer runs. */
  timerSound: HabitTimerSoundSchema.optional(),
  /** Minutes before timeRange.start to fire a local reminder */
  remindMinutesBefore: z.number().int().nonnegative().optional(),
  /**
   * Local clock times (HH:mm) to remind on each scheduled day, independent of
   * the time window. Stored once each, in clock order.
   */
  reminderTimes: z
    .array(HabitTimeHHmmSchema)
    .default([])
    .transform(normalizeReminderTimes),
  /** Show current success or failure streak on the habit card */
  showStreakOnCard: z.boolean().optional(),
  /** Optional curated Material Community Icon for Home / library identity. */
  icon: OptionalTrackerIconSchema,
  /** A neutral short name to show on a locked phone in place of the real one. */
  lockScreenName: z.string().optional().transform(normalizeLockScreenName),
});

export type HabitConfig = z.infer<typeof HabitConfigSchema>;

export const HabitEventMetaSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('habit_tick') }),
  z.object({
    source: z.literal('timer_session'),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    durationSeconds: z.number().nonnegative(),
    /** Set when a play_once track finished naturally (not manual Done). */
    trackCompleted: z.boolean().optional(),
    /** The habit's seconds goal when this session was logged. */
    goalSeconds: z.number().int().positive().optional(),
  }),
  /**
   * Done pressed on a timed habit before its goal: value 0, so the day keeps
   * the seconds actually logged and Undo removes only this event.
   */
  z.object({ source: z.literal('manual_complete') }),
]);

export type HabitEventMeta = z.infer<typeof HabitEventMetaSchema>;

export const DEFAULT_HABIT_CONFIG: HabitConfig = {
  trackingMode: 'boolean',
  timeSlot: 'anytime',
  schedule: { type: 'daily' },
  reminderTimes: [],
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
  timeSlot?: HabitTimeSlot;
  targetLabel?: string;
  timeRange?: HabitTimeRange;
  visibleOnlyInTimeRange?: boolean;
  dailyTargetSeconds?: number;
  timerSound?: HabitTimerSound;
  schedule?: HabitSchedule;
  remindMinutesBefore?: number;
  reminderTimes?: readonly string[];
  showStreakOnCard?: boolean;
  icon?: TrackerIconId;
  lockScreenName?: string;
};

export function shouldShowHabitStreakOnCard(config: HabitConfig): boolean {
  // Default on — seeing a streak before check-off motivates “one more.” Opt out with false.
  return config.showStreakOnCard !== false;
}

export function buildHabitConfig(
  input: Omit<HabitInput, 'name'>,
): HabitConfig {
  const lockScreenName = normalizeLockScreenName(input.lockScreenName);
  return {
    trackingMode: input.trackingMode ?? 'boolean',
    timeSlot: input.timeSlot ?? 'anytime',
    schedule: input.schedule ?? { type: 'daily' },
    ...(input.targetLabel?.trim() ? { targetLabel: input.targetLabel.trim() } : {}),
    ...(input.timeRange ? { timeRange: input.timeRange } : {}),
    ...(input.visibleOnlyInTimeRange ? { visibleOnlyInTimeRange: true } : {}),
    ...(input.trackingMode === 'timer' &&
    input.dailyTargetSeconds &&
    input.dailyTargetSeconds > 0
      ? { dailyTargetSeconds: input.dailyTargetSeconds }
      : {}),
    ...(input.timerSound ? { timerSound: input.timerSound } : {}),
    ...(input.remindMinutesBefore !== undefined && input.remindMinutesBefore >= 0
      ? { remindMinutesBefore: input.remindMinutesBefore }
      : {}),
    reminderTimes: normalizeReminderTimes(input.reminderTimes ?? []),
    ...(input.showStreakOnCard === false
      ? { showStreakOnCard: false }
      : { showStreakOnCard: true }),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(lockScreenName ? { lockScreenName } : {}),
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
    parts.push(
      config.visibleOnlyInTimeRange
        ? i18n.t('trackers:metaLines.timeRangeScheduled', { range })
        : range,
    );
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

/**
 * Home timer card meta: target-only while idle with no progress; elapsed/target
 * once running or after any logged time. Open-ended idle → null (hide label).
 */
export function formatHabitHomeTimerLabel(options: {
  displayTotal: number;
  effectiveTargetSeconds: number | undefined;
  isRunning: boolean;
}): string | null {
  const { displayTotal, effectiveTargetSeconds, isRunning } = options;
  const showElapsed = isRunning || displayTotal > 0;
  const hasTarget =
    effectiveTargetSeconds !== undefined && effectiveTargetSeconds > 0;

  if (hasTarget) {
    return showElapsed
      ? `${formatHabitTimerDuration(displayTotal)} / ${formatHabitTimerDuration(effectiveTargetSeconds)}`
      : formatHabitTimerDuration(effectiveTargetSeconds);
  }

  return showElapsed ? formatHabitTimerDuration(displayTotal) : null;
}

export function timerSessionDurationSeconds(startedAt: Date, endedAt: Date): number {
  return Math.max(1, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}

export function buildTimerSessionPayload(
  startedAt: Date,
  endedAt: Date,
): { value: number; meta: Extract<HabitEventMeta, { source: 'timer_session' }> } {
  const durationSeconds = timerSessionDurationSeconds(startedAt, endedAt);
  return buildTimerSessionPayloadFromDuration(startedAt, endedAt, durationSeconds);
}

export interface TimerSessionOptions {
  trackCompleted?: boolean;
  goalSeconds?: number;
}

export function buildTimerSessionPayloadFromDuration(
  startedAt: Date,
  endedAt: Date,
  durationSeconds: number,
  options?: TimerSessionOptions,
): { value: number; meta: Extract<HabitEventMeta, { source: 'timer_session' }> } {
  const seconds = Math.max(1, durationSeconds);
  return {
    value: seconds,
    meta: {
      source: 'timer_session',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds: seconds,
      ...(options?.trackCompleted ? { trackCompleted: true } : {}),
      ...(options?.goalSeconds === undefined ? {} : { goalSeconds: options.goalSeconds }),
    },
  };
}

export function buildTimerSessionPayloadFromSession(
  session: ActiveTimerSession,
  endedAt = new Date(),
  options?: TimerSessionOptions,
): { value: number; meta: Extract<HabitEventMeta, { source: 'timer_session' }> } {
  const startedAt = new Date(session.startedAt);
  const durationSeconds = Math.max(1, activeTimerElapsedSeconds(session, endedAt.getTime()));
  return buildTimerSessionPayloadFromDuration(startedAt, endedAt, durationSeconds, options);
}

export function liveTimerTotalSeconds(
  loggedTotalSeconds: number,
  activeSession: ActiveTimerSession | null | undefined,
  nowMs = Date.now(),
): number {
  if (!activeSession) {
    return loggedTotalSeconds;
  }
  return loggedTotalSeconds + activeTimerElapsedSeconds(activeSession, nowMs);
}

export type { ActiveTimerSession } from '../activeTimerSession';
export {
  ActiveTimerSessionSchema,
  activeTimerElapsedMs,
  activeTimerElapsedSeconds,
  createActiveTimerSession,
  isActiveTimerPaused,
} from '../activeTimerSession';
