import { z } from 'zod';
import { HabitScheduleSchema } from './schedule';

/**
 * The file the lock-screen widget reads: today as the app last saw it, and
 * enough of each tracker to work out "what is due" on a day the app has not
 * run yet. Written by JavaScript only; `docs/widget-contract.md` is the
 * contract the native side is built against, and must change with this.
 */

export const WIDGET_SNAPSHOT_VERSION = 2;

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

/** One day of a short strip, oldest first; `not_counted` is a day before the tracker existed. */
const StripDaySchema = z.object({
  date: LocalDate,
  /** On today, `not_done` means "not yet"; on a commitment, a slip. */
  state: z.enum(['done', 'not_done', 'not_due', 'not_counted']),
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
  /** The last seven days ending today, oldest first. */
  sevenDays: z.array(StripDaySchema).length(7),
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

/** Kept on a day with no slip; its `total` is today's slips. Details in the top-level `commitment`. */
const CommitmentTrackerSchema = TrackerBaseSchema.extend({
  kind: z.literal('commitment'),
  /** Always set for a commitment ("Clear" unless chosen). */
  lockScreenName: z.string().min(1),
  unit: z.literal('slips'),
});

export const WidgetSnapshotTrackerSchema = z.discriminatedUnion('kind', [
  HabitTrackerSchema,
  CounterTrackerSchema,
  CommitmentTrackerSchema,
]);

const CommitmentSchema = z.object({
  /** The commitment's `id` in `trackers`. */
  id: z.string().uuid(),
  lockScreenName: z.string().min(1),
  /** The time clear counts from: the start, or the latest slip. */
  clearSince: IsoInstant,
  lampsPassed: z.number().int().nonnegative(),
  nextLamp: z.object({
    at: IsoInstant,
    /** Hours after `clearSince`. */
    hours: z.number().int().positive(),
    /** Short, in the app's language: "48h", "5d". */
    label: z.string().min(1),
  }),
  /** His own line for now, or null when he has written none. It may be shown on the lock screen. */
  ownLine: z.string().nullable(),
  /** How long an urge's ride lasts; for an `urge_logged` not yet in a snapshot. */
  rideSeconds: z.number().int().positive(),
  /** Every urge ever ridden out; nothing resets it. */
  urgesRiddenOut: z.number().int().nonnegative(),
  urgesToday: z.number().int().nonnegative(),
  /** At most two timed habits to start instead, in the order chosen. */
  insteadHabits: z.array(
    z.object({
      id: z.string().uuid(),
      lockScreenName: z.string().nullable(),
      icon: z.string().nullable(),
      /** The seconds goal, or null for a play-once or open timer. */
      goalSeconds: z.number().int().positive().nullable(),
    }),
  ),
  /** The last fourteen days ending today, oldest first. */
  days: z
    .array(z.object({ date: LocalDate, state: z.enum(['done', 'slip', 'not_counted']) }))
    .length(14),
});

const RideSchema = z.object({
  urgeId: z.string().uuid(),
  startedAt: IsoInstant,
  endsAt: IsoInstant,
});

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
  /** The commitment not archived, or null when there is none. */
  commitment: CommitmentSchema.nullable(),
  /** The latest urge's ride while it is still open, or null. */
  ride: RideSchema.nullable(),
  /** Reminders still to come today for trackers due and not done, earliest first. */
  nextReminders: z.array(
    z.object({ trackerId: z.string().uuid(), time: LocalClockTime, at: IsoInstant }),
  ),
});

export type WidgetSnapshot = z.infer<typeof WidgetSnapshotSchema>;
export type WidgetSnapshotTracker = z.infer<typeof WidgetSnapshotTrackerSchema>;
