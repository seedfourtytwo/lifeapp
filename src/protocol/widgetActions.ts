import { z } from 'zod';
import { TimerSessionRecordSchema } from './coreTimer';
import { UrgeOutcomeSchema } from './urge';

/**
 * One line of the pending-actions queue: a tap the widget took while the app
 * may not have been running, or a timer session the native core finished.
 * Native appends; JavaScript drains and applies each through the app's own
 * commands. `docs/widget-contract.md` (contract version 3) holds the append
 * and drain protocol and must change with this.
 */

export const WIDGET_ACTION_VERSION = 1;

const LineBaseSchema = z.object({
  v: z.literal(WIDGET_ACTION_VERSION),
  /** Unique per tap; applying the same id twice has no further effect. */
  id: z.string().uuid(),
  /** When the tap happened. */
  at: z.string().datetime(),
  /** The app day (local date) the tap was made on. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ActionBaseSchema = LineBaseSchema.extend({ trackerId: z.string().uuid() });

export const WidgetActionSchema = z.discriminatedUnion('type', [
  /** Tick a check-off habit; never un-ticks one. */
  ActionBaseSchema.extend({ type: z.literal('habit_complete') }),
  ActionBaseSchema.extend({
    type: z.literal('counter_add'),
    amount: z.number().positive().max(10_000),
  }),
  /**
   * A session the native core finished (Done, stop, or its track's end). The
   * timer itself is controlled natively; contract v1's timer_start, _pause,
   * _resume, _done and _discard lines are no longer a known type, so a drain
   * skips them.
   */
  TimerSessionRecordSchema,
  /** An urge logged with one tap; the line's id becomes the urge's. */
  LineBaseSchema.extend({ type: z.literal('urge_logged') }),
  /** An urge resolved at `at`; one already resolved keeps its first outcome. */
  LineBaseSchema.extend({
    type: z.literal('urge_resolved'),
    urgeId: z.string().uuid(),
    outcome: UrgeOutcomeSchema,
  }),
]);

export type WidgetAction = z.infer<typeof WidgetActionSchema>;
export type UrgeAction = Extract<WidgetAction, { type: 'urge_logged' | 'urge_resolved' }>;
export type TrackerAction = Exclude<WidgetAction, UrgeAction>;

/** Why an action was read but not applied. */
export type WidgetActionDropReason =
  | 'tracker_missing'
  | 'tracker_archived'
  | 'wrong_kind'
  | 'not_a_timer'
  | 'future_day'
  /** An `urge_resolved` for an urge never logged (its line lost or cut off). */
  | 'urge_missing';
