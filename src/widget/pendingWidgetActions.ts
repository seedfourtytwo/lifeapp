import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../db/client';
import { withGuardedWrite } from '../db/dataGeneration';
import * as elementRepo from '../db/repositories/elementRepository';
import {
  loadWidgetActionLog,
  saveWidgetActionLog,
  type WidgetActionLogEntry,
} from '../db/repositories/widgetActionLogRepository';
import {
  discardHabitTimerSession,
  markHabitTimerDone,
  pauseHabitTimerSession,
  resumeHabitTimerSession,
  startHabitTimerSession,
} from '../habitTimer/habitTimerControls';
import type { ElementDefinition } from '../protocol';
import {
  WidgetActionSchema,
  type WidgetAction,
  type WidgetActionDropReason,
} from '../protocol/widgetActions';
import { useEventStore, whenActiveTimersReady } from '../store/eventStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { widgetDirectory } from './widgetFiles';

/** The widget appends here. */
export const PENDING_ACTIONS_FILE = 'pending-actions.jsonl';
/** The queue being applied; only JavaScript touches it. */
export const DRAINING_ACTIONS_FILE = 'pending-actions.draining.jsonl';

export interface DrainResult {
  applied: number;
  /** Already handled in an earlier drain: same id, no second effect. */
  duplicates: number;
  dropped: { id: string; reason: WidgetActionDropReason }[];
  /** Lines that were not a valid action of a known version; skipped. */
  malformed: number;
}

type Verdict = { apply: () => Promise<unknown> } | { drop: WidgetActionDropReason };

function judge(action: WidgetAction, element: ElementDefinition | null, today: string): Verdict {
  if (!element) return { drop: 'tracker_missing' };
  if (element.archivedAt != null) return { drop: 'tracker_archived' };
  if (action.day > today) return { drop: 'future_day' };
  const { getState } = useEventStore;

  if (action.type === 'counter_add') {
    if (element.kind !== 'counter') return { drop: 'wrong_kind' };
    // The action's id becomes the event's, so a second apply inserts nothing.
    return {
      apply: () =>
        getState().logEvent(
          element.id,
          action.amount,
          { source: 'quick_button', increment: action.amount },
          { id: action.id, timestamp: action.at, date: action.day },
        ),
    };
  }
  if (element.kind !== 'habit') return { drop: 'wrong_kind' };
  const { config } = element;
  if (action.type === 'habit_complete') {
    // A tick on a timer would log one second; a timer is finished with timer_done.
    if (config.trackingMode === 'timer') return { drop: 'wrong_kind' };
    // On the day it was made, even when that day has ended; completing twice is a no-op.
    return { apply: () => getState().completeHabit(element.id, config, action.day) };
  }

  if (config.trackingMode !== 'timer') return { drop: 'not_a_timer' };
  // A session lives on today's clock: a tap for a day that has ended means nothing now.
  if (action.day < today) return { drop: 'day_ended' };
  switch (action.type) {
    case 'timer_start':
      return { apply: () => startHabitTimerSession(element.id, config) };
    case 'timer_pause':
      return { apply: async () => pauseHabitTimerSession(element.id, config) };
    case 'timer_resume':
      return { apply: async () => resumeHabitTimerSession(element.id, config) };
    case 'timer_done':
      return { apply: () => markHabitTimerDone(element.id, config) };
    case 'timer_discard':
      return { apply: () => discardHabitTimerSession(element.id) };
    default: {
      const unknown: never = action;
      throw new Error(`Unknown widget action ${JSON.stringify(unknown)}`);
    }
  }
}

/** Event writes are made safe to repeat by id; timer taps are not, so they are logged first. */
function loggedBeforeApplying(action: WidgetAction): boolean {
  return action.type !== 'counter_add' && action.type !== 'habit_complete';
}

function parseLines(text: string, result: DrainResult): WidgetAction[] {
  const lines = text.split('\n');
  // What follows the last newline is a line still being written, or one cut
  // off: the widget writes it again if it was, so it is skipped here.
  const unfinished = lines.pop() ?? '';
  if (unfinished.trim() !== '') result.malformed += 1;

  const actions: WidgetAction[] = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      result.malformed += 1;
      continue;
    }
    const parsed = WidgetActionSchema.safeParse(raw);
    if (parsed.success) actions.push(parsed.data);
    else result.malformed += 1;
  }
  return actions;
}

async function applyFile(uri: string, result: DrainResult): Promise<void> {
  const actions = parseLines(await FileSystem.readAsStringAsync(uri), result);
  const db = await getDatabase();
  const log = await loadWidgetActionLog(db);
  const record = async (entry: WidgetActionLogEntry) => {
    log.set(entry.id, entry);
    await withGuardedWrite('protocol', () => saveWidgetActionLog(db, log));
  };

  for (const action of actions) {
    if (log.has(action.id)) {
      result.duplicates += 1;
      continue;
    }
    const element = await elementRepo.getElementById(db, action.trackerId);
    const verdict = judge(action, element, currentAppCalendarDate());
    if ('drop' in verdict) {
      result.dropped.push({ id: action.id, reason: verdict.drop });
      await record({ id: action.id, at: action.at, outcome: 'dropped', reason: verdict.drop });
      continue;
    }
    const entry: WidgetActionLogEntry = { id: action.id, at: action.at, outcome: 'applied' };
    if (loggedBeforeApplying(action)) await record(entry);
    await verdict.apply();
    if (!loggedBeforeApplying(action)) await record(entry);
    result.applied += 1;
  }
}

async function exists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

async function drainOnce(): Promise<DrainResult> {
  const result: DrainResult = { applied: 0, duplicates: 0, dropped: [], malformed: 0 };
  const directory = widgetDirectory();
  if (!directory) return result;
  // Timer taps need the sessions a cold start restores.
  await whenActiveTimersReady();
  const pending = `${directory}${PENDING_ACTIONS_FILE}`;
  const draining = `${directory}${DRAINING_ACTIONS_FILE}`;

  // First a queue a drain that died left behind, then whatever came since.
  for (let round = 0; round < 2; round += 1) {
    if (!(await exists(draining))) {
      if (!(await exists(pending))) break;
      await FileSystem.moveAsync({ from: pending, to: draining });
    }
    await applyFile(draining, result);
    await FileSystem.deleteAsync(draining, { idempotent: true });
  }
  return result;
}

let draining: Promise<DrainResult> | null = null;

/**
 * Apply every tap the widget queued, each through the app's own commands,
 * each at most once. Calls while a drain runs join it. A line that is not a
 * valid action is counted and skipped; one bad line never stops the rest.
 */
export function drainPendingWidgetActions(): Promise<DrainResult> {
  if (!draining) {
    draining = drainOnce().finally(() => {
      draining = null;
    });
  }
  return draining;
}
