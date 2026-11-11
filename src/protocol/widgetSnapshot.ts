import { z } from 'zod';
import { HabitScheduleSchema } from './schedule';

/**
 * The file the lock-screen widget reads: today as the app last saw it, and
 * enough of each tracker to work out "what is due" on a day the app has not
 * run yet. Written by JavaScript only; `docs/widget-contract.md` is the
 * contract the native side is built against, and must change with this.
 */

export const WIDGET_SNAPSHOT_VERSION = 1;

const IsoInstant = z.string().datetime();
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LocalClockTime = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const DoneReasonSchema = z.enum([
  'checked',
  'not_checked',
  'target_met',
  'under_target',
  'track_finished',
  'track_not_finished',
  'time_logged',
  'nothing_logged',
  'marked_complete',
  'no_target',
  /** A commitment's day: no slip in it, or a slip. */
  'clear',
  'slipped',
  /** A timer still running has passed its seconds goal; not yet logged. */
  'running_past_goal',
]);

const TimerGoalSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('seconds'), seconds: z.number().int().positive() }),
  z.object({ type: z.literal('play_once'), trackSeconds: z.number().int().positive() }),
  z.object({ type: z.literal('open') }),
]);

const RunningSessionSchema = z.object({
  /** When the session began (or local midnight, for one carried over into today). */
  startedAt: IsoInstant,
  /** Set while paused: the moment it was paused. */
  pausedAt: IsoInstant.nullable(),
  /** Milliseconds spent in pauses that have ended. */
  pausedMs: z.number().int().nonnegative(),
  /** Active seconds at `generatedAt`. */
  elapsedSeconds: z.number().int().nonnegative(),
  paused: z.boolean(),
});

const TrackerBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** The neutral name for a locked phone; null means show the icon only. */
  lockScreenName: z.string().nullable(),
  /** A MaterialCommunityIcons glyph name, or one of the app's own ('push-up', 'pull-up'). */
  icon: z.string().nullable(),
  dueToday: z.boolean(),
  done: z.boolean(),
  reason: DoneReasonSchema,
  /** Today's logged amount: ticks, seconds or counts (see `unit`). */
  total: z.number().nonnegative(),
  /** The amount that finishes the day, in the same unit; null when there is none. */
  target: z.number().positive().nullable(),
  streak: z.number().int().nonnegative(),
  schedule: HabitScheduleSchema,
  /** Local HH:mm clock times this tracker reminds at on a due day. */
  reminderTimes: z.array(LocalClockTime),
});

const HabitTrackerSchema = TrackerBaseSchema.extend({
  kind: z.literal('habit'),
  trackingMode: z.enum(['boolean', 'timer']),
  unit: z.enum(['ticks', 'seconds']),
  /** Shown only inside this local window when `visibleOnlyInTimeRange`. */
  timeRange: z.object({ start: LocalClockTime, end: LocalClockTime }).nullable(),
  visibleOnlyInTimeRange: z.boolean(),
  /** Present for `trackingMode: 'timer'` only. */
  timer: z
    .object({
      goal: TimerGoalSchema,
      session: RunningSessionSchema.nullable(),
    })
    .nullable(),
});

const CounterTrackerSchema = TrackerBaseSchema.extend({
  kind: z.literal('counter'),
  unit: z.string().min(1),
  quickIncrements: z.array(z.number().positive()).min(1),
});

export const WidgetSnapshotTrackerSchema = z.discriminatedUnion('kind', [
  HabitTrackerSchema,
  CounterTrackerSchema,
]);

export const WidgetSnapshotSchema = z.object({
  version: z.literal(WIDGET_SNAPSHOT_VERSION),
  generatedAt: IsoInstant,
  day: z.object({
    /** The app day described, local to `timeZone`. */
    date: LocalDate,
    /** The next local midnight: after it, nothing below describes today. */
    endsAt: IsoInstant,
    /** IANA zone the local dates and clock times are in. */
    timeZone: z.string().min(1),
    /** Offset from UTC at `generatedAt`, minutes east (Paris in winter: 60). */
    utcOffsetMinutes: z.number().int(),
  }),
  /** Every tracker on Home, in Home's order; `dueToday` says which belong to today. */
  trackers: z.array(WidgetSnapshotTrackerSchema),
  /** Reminders still to come today for trackers due and not done, earliest first. */
  nextReminders: z.array(
    z.object({ trackerId: z.string().uuid(), time: LocalClockTime, at: IsoInstant }),
  ),
});

export type WidgetSnapshot = z.infer<typeof WidgetSnapshotSchema>;
export type WidgetSnapshotTracker = z.infer<typeof WidgetSnapshotTrackerSchema>;
