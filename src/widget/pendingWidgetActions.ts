import * as FileSystem from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { withGuardedWrite } from '../db/dataGeneration';
import * as elementRepo from '../db/repositories/elementRepository';
import * as urgeRepo from '../db/repositories/urgeRepository';
import {
  loadWidgetActionLog,
  saveWidgetActionLog,
  type WidgetActionLogEntry,
} from '../db/repositories/widgetActionLogRepository';
import type { ElementDefinition } from '../protocol';
import type { TimerSessionRecord } from '../protocol/coreTimer';
import {
  WidgetActionSchema,
  type TrackerAction,
  type UrgeAction,
  type WidgetAction,
  type WidgetActionDropReason,
} from '../protocol/widgetActions';
import { useEventStore } from '../store/eventStore';
import { useUrgeStore } from '../store/urgeStore';
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

function judgeTrackerAction(
  action: TrackerAction,
  element: ElementDefinition | null,
  today: string,
): Verdict {
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
  switch (action.type) {
    case 'habit_complete':
      // A tick on a timer would log one second; a timer ends in a timer_session.
      if (config.trackingMode === 'timer') return { drop: 'wrong_kind' };
      // On the day it was made, even when that day has ended; completing twice is a no-op.
      return { apply: () => getState().completeHabit(element.id, config, action.day) };
    case 'timer_session':
      if (config.trackingMode !== 'timer') return { drop: 'not_a_timer' };
      // Its rows take ids derived from the record's, so a second apply inserts nothing.
      return { apply: () => getState().applyTimerSession(element.id, config, action) };
    default: {
      const unknown: never = action;
      throw new Error(`Unknown widget action ${JSON.stringify(unknown)}`);
    }
  }
}

async function judgeUrgeAction(
  db: SQLiteDatabase,
  action: UrgeAction,
  today: string,
): Promise<Verdict> {
  if (action.day > today) return { drop: 'future_day' };
  const { getState } = useUrgeStore;
  switch (action.type) {
    case 'urge_logged':
      return {
        apply: () =>
          getState().recordLoggedUrge({ id: action.id, at: action.at, day: action.day }, 'widget'),
      };
    case 'urge_resolved':
      if (!(await urgeRepo.urgeExists(db, action.urgeId))) return { drop: 'urge_missing' };
      return { apply: () => getState().resolveUrge(action.urgeId, action.outcome, action.at) };
    default: {
      const unknown: never = action;
      throw new Error(`Unknown widget action ${JSON.stringify(unknown)}`);
    }
  }
}

function isUrgeAction(action: WidgetAction): action is UrgeAction {
  return action.type === 'urge_logged' || action.type === 'urge_resolved';
}

/**
 * File order, except that resolves go last: a resolve can only follow its
 * log, but a widget writing both in one burst may land them in either order.
 * Nothing else depends on a resolve, so moving it later changes no other line.
 */
function applyOrder(actions: readonly WidgetAction[]): WidgetAction[] {
  return [
    ...actions.filter((action) => action.type !== 'urge_resolved'),
    ...actions.filter((action) => action.type === 'urge_resolved'),
  ];
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

function emptyResult(): DrainResult {
  return { applied: 0, duplicates: 0, dropped: [], malformed: 0 };
}

/** Each action at most once by its id, judged and logged with its outcome. */
async function applyActions(actions: readonly WidgetAction[], result: DrainResult): Promise<void> {
  const db = await getDatabase();
  const log = await loadWidgetActionLog(db);
  const record = async (entry: WidgetActionLogEntry) => {
    log.set(entry.id, entry);
    await withGuardedWrite('protocol', () => saveWidgetActionLog(db, log));
  };

  for (const action of applyOrder(actions)) {
    if (log.has(action.id)) {
      result.duplicates += 1;
      continue;
    }
    const today = currentAppCalendarDate();
    const verdict = isUrgeAction(action)
      ? await judgeUrgeAction(db, action, today)
      : judgeTrackerAction(action, await elementRepo.getElementById(db, action.trackerId), today);
    if ('drop' in verdict) {
      result.dropped.push({ id: action.id, reason: verdict.drop });
      await record({ id: action.id, at: action.at, outcome: 'dropped', reason: verdict.drop });
      continue;
    }
    // Every action is safe to repeat by id, so it is logged once it has applied.
    await verdict.apply();
    await record({ id: action.id, at: action.at, outcome: 'applied' });
    result.applied += 1;
  }
}

async function applyFile(uri: string, result: DrainResult): Promise<void> {
  await applyActions(parseLines(await FileSystem.readAsStringAsync(uri), result), result);
}

async function exists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

async function drainOnce(): Promise<DrainResult> {
  const result = emptyResult();
  const directory = widgetDirectory();
  if (!directory) return result;
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

/** Drains and single applies run one after another, so the applied log is never written twice at once. */
let applying: Promise<unknown> = Promise.resolve();

function exclusively<T>(work: () => Promise<T>): Promise<T> {
  const next = applying.catch(() => undefined).then(work);
  applying = next.catch(() => undefined);
  return next;
}

let draining: Promise<DrainResult> | null = null;

/**
 * Apply every line native queued, each through the app's own commands,
 * each at most once. Calls while a drain runs join it. A line that is not a
 * valid action is counted and skipped; one bad line never stops the rest.
 */
export function drainPendingWidgetActions(): Promise<DrainResult> {
  if (!draining) {
    draining = exclusively(drainOnce).finally(() => {
      draining = null;
    });
  }
  return draining;
}

/**
 * Log a session the app itself just finished, without waiting for the
 * queue: the same rules and the same applied log as a drain, so the copy
 * native queued is skipped as a duplicate when the drain reaches it.
 */
export function applyFinishedTimerSession(record: TimerSessionRecord): Promise<DrainResult> {
  return exclusively(async () => {
    const result = emptyResult();
    await applyActions([record], result);
    return result;
  });
}
