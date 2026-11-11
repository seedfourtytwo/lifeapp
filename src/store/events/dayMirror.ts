import {
  activeTimerElapsedMs,
  dayOutcome,
  factsFromTotal,
  habitTimerGoal,
  isCounterElement,
  isHabitElement,
  type HabitConfig,
} from '../../protocol';
import { getDatabase } from '../../db/client';
import * as eventRepo from '../../db/repositories/eventRepository';
import * as elementRepo from '../../db/repositories/elementRepository';
import { loadCounterStreakForElement } from '../counterStreakFetch';
import { loadHabitStreakForElement } from '../habitStreakFetch';
import { todayDate, type EventState, type GetEventState, type SetEventState } from './state';

/**
 * The day mirror: today's totals and done state as SQLite holds them, read
 * in order and never patched from outside except for a stopping timer.
 */

/**
 * Every read of today's state, whether a bulk load or the re-query after a
 * write, runs here one at a time in the order asked for, and applies what it
 * read before the next starts. A read asked for after a write committed can
 * therefore only be followed by reads that saw at least as much, so no older
 * result ever lands over a newer one.
 */
let mirrorReads: Promise<unknown> = Promise.resolve();

export function inMirrorOrder<T>(read: () => Promise<T>): Promise<T> {
  const next = mirrorReads.catch(() => undefined).then(read);
  mirrorReads = next.catch(() => undefined);
  return next;
}

export function applyTodayMaps(
  elementId: string,
  date: string,
  patch: Partial<{
    dailyTotal: number;
    habitDone: boolean;
    /** Only read with `habitDone`; absent means the day is not done by the mark alone. */
    habitMarked: boolean;
    streak: number;
    failureStreak: number;
  }>,
  set: SetEventState,
  get: GetEventState,
): void {
  if (date !== todayDate()) return;
  set({
    ...(patch.dailyTotal !== undefined
      ? { dailyTotals: { ...get().dailyTotals, [elementId]: patch.dailyTotal } }
      : {}),
    ...(patch.habitDone !== undefined
      ? {
          habitDoneToday: { ...get().habitDoneToday, [elementId]: patch.habitDone },
          habitMarkedToday: {
            ...get().habitMarkedToday,
            [elementId]: patch.habitDone && (patch.habitMarked ?? false),
          },
        }
      : {}),
    ...(patch.streak !== undefined
      ? { habitStreaks: { ...get().habitStreaks, [elementId]: patch.streak } }
      : {}),
    ...(patch.failureStreak !== undefined
      ? {
          habitFailureStreaks: {
            ...get().habitFailureStreaks,
            [elementId]: patch.failureStreak,
          },
        }
      : {}),
  });
}

/**
 * When a running timer with a seconds goal reaches it, the day is done — for
 * the header, the list order, the lock-screen queue and the evening count, not
 * only the card that ticks every second. Each running session has at most one
 * pending crossing; pausing, stopping or discarding it cancels the crossing.
 */
const targetCrossings = new Map<string, ReturnType<typeof setTimeout>>();

export function disarmTargetCrossing(elementId: string): void {
  const pending = targetCrossings.get(elementId);
  if (pending !== undefined) clearTimeout(pending);
  targetCrossings.delete(elementId);
}

export function armTargetCrossing(
  elementId: string,
  config: HabitConfig,
  set: SetEventState,
  get: GetEventState,
): void {
  disarmTargetCrossing(elementId);
  const session = get().activeTimerSessions[elementId];
  const goal = habitTimerGoal(config);
  if (!session || session.pausedAt || config.trackingMode !== 'timer' || goal.type !== 'seconds') {
    return;
  }
  // The running session will record today's goal, so it is judged by it.
  const logged = session.calendarDate === get().dayMapsDate ? (get().dailyTotals[elementId] ?? 0) : 0;
  const remainingMs = (goal.seconds - logged) * 1000 - activeTimerElapsedMs(session);
  const markDone = () =>
    applyTodayMaps(elementId, session.calendarDate, { habitDone: true }, set, get);
  if (remainingMs <= 0) {
    markDone();
    return;
  }
  targetCrossings.set(
    elementId,
    setTimeout(() => {
      targetCrossings.delete(elementId);
      const current = get().activeTimerSessions[elementId];
      if (current?.startedAt === session.startedAt && !current.pausedAt) markDone();
    }, remainingMs),
  );
}

/**
 * Re-read one tracker's today from SQLite — its definition, total, done state
 * and streak — and show that. Every event write ends here, failed or not, so
 * the screen shows what the database holds and nothing else.
 */
export function requeryElementDay(
  elementId: string,
  set: SetEventState,
  get: GetEventState,
): Promise<void> {
  return inMirrorOrder(async () => {
    const db = await getDatabase();
    const element = await elementRepo.getElementById(db, elementId);
    if (!element) return;
    const date = todayDate();
    const facts =
      (await eventRepo.getDayFactsForElementsOnDate(db, [elementId], date)).get(elementId) ??
      factsFromTotal(0);
    if (isHabitElement(element)) {
      const outcome = dayOutcome(element, facts);
      const { streak, failureStreak } = await loadHabitStreakForElement(
        elementId,
        element.config,
        element.createdAt ?? null,
      );
      applyTodayMaps(
        elementId,
        date,
        {
          dailyTotal: outcome.total,
          habitDone: outcome.done,
          habitMarked: outcome.reason === 'marked_complete',
          streak,
          failureStreak,
        },
        set,
        get,
      );
      // A running timer already past its goal keeps the day done.
      armTargetCrossing(elementId, element.config, set, get);
      return;
    }
    if (isCounterElement(element)) {
      const streak = await loadCounterStreakForElement(
        elementId,
        element.config,
        element.createdAt ?? null,
      );
      if (date !== todayDate()) return;
      set({
        dailyTotals: { ...get().dailyTotals, [elementId]: facts.total },
        counterStreaks: { ...get().counterStreaks, [elementId]: streak },
      });
    }
  });
}

type DayMirrorActions = Pick<EventState, 'loadCounterTotals' | 'loadHabitDayState'>;

export function createDayMirrorActions(set: SetEventState, get: GetEventState): DayMirrorActions {
  return {
    loadCounterTotals: (elementIds) =>
      inMirrorOrder(async () => {
        if (elementIds.length === 0) {
          set({ counterTotalsReady: true });
          return;
        }
        const totals = await eventRepo.getDailyTotalsForElementsOnDate(
          await getDatabase(),
          elementIds,
          todayDate(),
        );
        set({
          dailyTotals: { ...get().dailyTotals, ...Object.fromEntries(totals) },
          counterTotalsReady: true,
        });
      }),

    loadHabitDayState: (habits, date = todayDate()) =>
      inMirrorOrder(async () => {
        if (habits.length === 0) {
          set({ dayStateReady: true });
          return;
        }
        const factsByElement = await eventRepo.getDayFactsForElementsOnDate(
          await getDatabase(),
          habits.map((h) => h.id),
          date,
        );

        const totals: Record<string, number> = {};
        const status: Record<string, boolean> = {};
        const marked: Record<string, boolean> = {};
        for (const { id, config } of habits) {
          const outcome = dayOutcome(
            { kind: 'habit', config },
            factsByElement.get(id) ?? factsFromTotal(0),
          );
          totals[id] = outcome.total;
          status[id] = outcome.done;
          marked[id] = outcome.reason === 'marked_complete';
        }

        set({
          dailyTotals: { ...get().dailyTotals, ...totals },
          habitDoneToday: { ...get().habitDoneToday, ...status },
          habitMarkedToday: { ...get().habitMarkedToday, ...marked },
          dayStateReady: true,
        });
        // SQLite has not seen a running session's seconds; one past its goal is done.
        for (const { id, config } of habits) armTargetCrossing(id, config, set, get);
      }),
  };
}
