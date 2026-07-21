import {
  filterHabitsDueToday,
  orderHabitsList,
  parseHabitConfig,
  type ElementDefinition,
  type HabitConfig,
} from '../protocol';
import { getActiveHabits } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

/** Habit currently shown on the lock-screen media controls (may or may not be timing). */
let focusedHabitId: string | null = null;

export function getFocusedHabitId(): string | null {
  return focusedHabitId;
}

export function setFocusedHabitId(elementId: string | null): void {
  focusedHabitId = elementId;
}

/** Today's due habits in Home order (remaining first, then done). */
export function getLockScreenHabitQueue(): ElementDefinition[] {
  const { elements, dashboard } = useElementStore.getState();
  const active = getActiveHabits(elements, dashboard);
  const now = new Date();
  const today = currentAppCalendarDate(now);
  const due = filterHabitsDueToday(active, {
    now,
    today,
    habitDoneToday: useEventStore.getState().habitDoneToday,
  });
  return orderHabitsList(due, useEventStore.getState().habitDoneToday);
}

function habitFromStore(elementId: string): {
  element: ElementDefinition;
  config: HabitConfig;
} | null {
  const element = useElementStore
    .getState()
    .elements.find((el) => el.id === elementId && el.kind === 'habit');
  if (!element) return null;
  return { element, config: parseHabitConfig(element.config) };
}

export function resolveFocusedHabit(): {
  element: ElementDefinition;
  config: HabitConfig;
} | null {
  const queue = getLockScreenHabitQueue();
  const sessions = useEventStore.getState().activeTimerSessions;
  const activeTimerId = Object.keys(sessions)[0];

  // Live timer always wins — even if time-range filtering hid it from the due queue.
  if (activeTimerId) {
    const fromQueue = queue.find((h) => h.id === activeTimerId);
    if (fromQueue) {
      focusedHabitId = activeTimerId;
      return { element: fromQueue, config: parseHabitConfig(fromQueue.config) };
    }
    const fromStore = habitFromStore(activeTimerId);
    if (fromStore) {
      focusedHabitId = activeTimerId;
      return fromStore;
    }
  }

  if (queue.length === 0) {
    focusedHabitId = null;
    return null;
  }

  if (!focusedHabitId || !queue.some((h) => h.id === focusedHabitId)) {
    focusedHabitId = queue[0].id;
  }

  const element = queue.find((h) => h.id === focusedHabitId) ?? queue[0];
  focusedHabitId = element.id;
  return { element, config: parseHabitConfig(element.config) };
}

export function peekAdjacentHabit(
  direction: 'next' | 'prev',
): { element: ElementDefinition; config: HabitConfig } | null {
  const queue = getLockScreenHabitQueue();
  if (queue.length === 0) return null;

  const current = resolveFocusedHabit();
  if (!current) return null;

  const index = queue.findIndex((h) => h.id === current.element.id);
  // Off-queue focused timer: next → first due habit, prev → last.
  if (index < 0) {
    const element = direction === 'next' ? queue[0] : queue[queue.length - 1];
    return { element, config: parseHabitConfig(element.config) };
  }

  const nextIndex =
    direction === 'next'
      ? (index + 1) % queue.length
      : (index - 1 + queue.length) % queue.length;

  const element = queue[nextIndex];
  return { element, config: parseHabitConfig(element.config) };
}
