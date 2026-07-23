import { z } from 'zod';
import { i18n } from '../../i18n';
import { isWithinTimeRange, formatTimeRange } from '../../utils/time';
import { sumEventValues } from '../../utils/events';
import {
  getHabitTimerPlaybackMode,
  hasHabitTimerSound,
} from '../habitSound';
import { getBundledHabitSoundDurationSeconds } from '../habitSoundCatalog';
import {
  formatScheduleDescription,
  HabitScheduleSchema,
  isScheduleActiveOnDate,
  isTimeRangeStartingSoon,
  type HabitSchedule,
} from '../schedule';
import { HabitTimerSoundSchema, type HabitTimerSound } from '../habitSound';
import type { LifeEvent } from '../event';
import {
  type ActiveTimerSession,
  activeTimerElapsedSeconds,
} from '../activeTimerSession';

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
  /** Show current success or failure streak on the habit card */
  showStreakOnCard: z.boolean().optional(),
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

export function parseHabitConfig(config: unknown): HabitConfig {
  return HabitConfigSchema.parse(config);
}

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
  showStreakOnCard?: boolean;
};

export function shouldShowHabitStreakOnCard(config: HabitConfig): boolean {
  // Default on — seeing a streak before check-off motivates “one more.” Opt out with false.
  return config.showStreakOnCard !== false;
}

export function buildHabitConfig(
  input: Omit<HabitInput, 'name'>,
): HabitConfig {
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
    ...(input.showStreakOnCard === false
      ? { showStreakOnCard: false }
      : { showStreakOnCard: true }),
  };
}

export function isHabitDayComplete(
  total: number,
  config: HabitConfig,
  dayEvents?: readonly Pick<LifeEvent, 'value' | 'meta'>[],
): boolean {
  if (config.trackingMode === 'timer') {
    if (config.dailyTargetSeconds && config.dailyTargetSeconds > 0) {
      return total >= config.dailyTargetSeconds;
    }
    // play_once without a seconds target: only a finished track counts — never
    // "any logged seconds" (that incorrectly completes after a short session).
    if (
      hasHabitTimerSound(config.timerSound) &&
      getHabitTimerPlaybackMode(config.timerSound) === 'play_once'
    ) {
      if (!dayEvents) return false;
      return dayEvents.some((event) => isTimerSessionTrackCompleted(event));
    }
    return total > 0;
  }
  return total >= 1;
}

/**
 * Seconds goal for progress UI: explicit daily target, else play_once track length.
 */
export function getHabitTimerEffectiveTargetSeconds(
  config: HabitConfig,
): number | undefined {
  if (config.dailyTargetSeconds && config.dailyTargetSeconds > 0) {
    return config.dailyTargetSeconds;
  }
  if (
    config.trackingMode !== 'timer' ||
    !hasHabitTimerSound(config.timerSound) ||
    getHabitTimerPlaybackMode(config.timerSound) !== 'play_once'
  ) {
    return undefined;
  }
  const trackId = config.timerSound?.trackId?.trim();
  if (!trackId) return undefined;
  return getBundledHabitSoundDurationSeconds(trackId);
}

/**
 * True when day completion can depend on event meta (play-once timer without a seconds target).
 * Those habits need full event rows for streaks / day state; everyone else can use daily SUMs.
 */
export function habitNeedsEventMetaForCompletion(config: HabitConfig): boolean {
  if (config.trackingMode !== 'timer') return false;
  if (config.dailyTargetSeconds && config.dailyTargetSeconds > 0) return false;
  return (
    hasHabitTimerSound(config.timerSound) &&
    getHabitTimerPlaybackMode(config.timerSound) === 'play_once'
  );
}

function isTimerSessionTrackCompleted(
  event: Pick<LifeEvent, 'meta'>,
): boolean {
  return (
    event.meta?.source === 'timer_session' &&
    event.meta.trackCompleted === true
  );
}

export function completedDatesFromHabitEvents(
  events: readonly LifeEvent[],
  config: HabitConfig,
): string[] {
  const byDate = new Map<string, LifeEvent[]>();
  for (const event of events) {
    const dayEvents = byDate.get(event.date) ?? [];
    dayEvents.push(event);
    byDate.set(event.date, dayEvents);
  }

  const completedDates: string[] = [];
  for (const [date, dayEvents] of byDate) {
    const total = sumEventValues(dayEvents);
    if (isHabitDayComplete(total, config, dayEvents)) {
      completedDates.push(date);
    }
  }
  return completedDates;
}

/** Completion dates from pre-aggregated daily totals (no per-event meta). */
export function completedDatesFromDailyTotals(
  dailyTotals: readonly { date: string; total: number }[],
  config: HabitConfig,
): string[] {
  const completedDates: string[] = [];
  for (const { date, total } of dailyTotals) {
    if (isHabitDayComplete(total, config)) {
      completedDates.push(date);
    }
  }
  return completedDates;
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

export function buildTimerSessionPayloadFromDuration(
  startedAt: Date,
  endedAt: Date,
  durationSeconds: number,
  options?: { trackCompleted?: boolean },
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
    },
  };
}

export function buildTimerSessionPayloadFromSession(
  session: ActiveTimerSession,
  endedAt = new Date(),
  options?: { trackCompleted?: boolean },
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
