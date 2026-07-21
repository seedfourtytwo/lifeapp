import {
  pauseHabitSound,
  playHabitSound,
  stopHabitSound,
  updateHabitTimerLockScreen,
} from '../audio/habitTimerSound';
import type { HabitConfig } from '../protocol';
import { useEventStore } from '../store/eventStore';
import {
  getLockScreenHabitQueue,
  resolveFocusedHabit,
} from './habitLockScreenQueue';
import {
  buildHabitReadyLockScreenMeta,
  buildHabitTimerLockScreenMeta,
  startHabitTimerLockScreenTicker,
  stopHabitTimerLockScreenTicker,
} from './habitTimerLockScreen';

export function habitNameFor(elementId: string): string {
  const focused = resolveFocusedHabit();
  if (focused?.element.id === elementId) return focused.element.name;
  const queue = getLockScreenHabitQueue();
  return queue.find((el) => el.id === elementId)?.name ?? 'Habit';
}

export function positionLabelFor(elementId: string): string | undefined {
  const queue = getLockScreenHabitQueue();
  const index = queue.findIndex((h) => h.id === elementId);
  if (index < 0 || queue.length <= 1) return undefined;
  return `${index + 1}/${queue.length}`;
}

export function lockScreenMetaFor(elementId: string, config: HabitConfig) {
  const session = useEventStore.getState().activeTimerSessions[elementId];
  const name = habitNameFor(elementId);
  if (session) {
    return buildHabitTimerLockScreenMeta(name, session, config);
  }
  return buildHabitReadyLockScreenMeta(name, config, positionLabelFor(elementId));
}

/** Live elapsed ticker — only while a timer session exists. */
export function refreshLockScreenTicker(): void {
  const focused = resolveFocusedHabit();
  if (!focused) {
    stopHabitTimerLockScreenTicker();
    return;
  }
  const session = useEventStore.getState().activeTimerSessions[focused.element.id];
  if (!session) {
    stopHabitTimerLockScreenTicker();
    return;
  }
  const { element, config } = focused;
  startHabitTimerLockScreenTicker(() => {
    const still = resolveFocusedHabit();
    if (!still || still.element.id !== element.id) return null;
    if (!useEventStore.getState().activeTimerSessions[element.id]) return null;
    return lockScreenMetaFor(element.id, config);
  });
}

/** Show the focused habit on the lock screen in a Ready (paused) state. */
export async function presentFocusedHabitReady(): Promise<void> {
  stopHabitTimerLockScreenTicker();
  const focused = resolveFocusedHabit();
  if (!focused) {
    await stopHabitSound();
    return;
  }
  const { element, config } = focused;
  const meta = buildHabitReadyLockScreenMeta(
    element.name,
    config,
    positionLabelFor(element.id),
  );
  await playHabitSound(undefined, { lockScreen: meta });
  await pauseHabitSound();
  updateHabitTimerLockScreen(meta);
}
