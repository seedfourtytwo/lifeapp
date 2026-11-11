import { z } from 'zod';
import { TimerSessionRecordSchema } from './coreTimer';

/**
 * One line of the pending-actions queue: a tap the widget took while the app
 * may not have been running, or a timer session the native core finished.
 * Native appends; JavaScript drains and applies each through the app's own
 * commands. `docs/widget-contract.md` (contract version 2) holds the append
 * and drain protocol and must change with this.
 */

export const WIDGET_ACTION_VERSION = 1;

const ActionBaseSchema = z.object({
  v: z.literal(WIDGET_ACTION_VERSION),
  /** Unique per tap; applying the same id twice has no further effect. */
  id: z.string().uuid(),
  /** When the tap happened. */
  at: z.string().datetime(),
  /** The app day (local date) the tap was made on. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trackerId: z.string().uuid(),
});

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
]);

export type WidgetAction = z.infer<typeof WidgetActionSchema>;

/** Why an action was read but not applied. */
export type WidgetActionDropReason =
  | 'tracker_missing'
  | 'tracker_archived'
  | 'wrong_kind'
  | 'not_a_timer'
  | 'future_day';
