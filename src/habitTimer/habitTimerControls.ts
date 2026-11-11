import { Alert } from 'react-native';
import { lifeCore } from '../core/lifeCore';
import { i18n } from '../i18n';
import {
  getHabitTimerPlaybackMode,
  habitTimerGoal,
  hasHabitTimerSound,
  isHabitElement,
  toDateString,
  type HabitConfig,
  type HabitElement,
} from '../protocol';
import type { TimerSessionRecord, TimerStartRequest } from '../protocol/coreTimer';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { todayDate } from '../store/events/state';
import { applyFinishedTimerSession } from '../widget/pendingWidgetActions';

/**
 * The habit timer's controls. The session itself (clock, sound, goal chime,
 * notification) lives in the native core; these apply the app's rules on
 * top: one timer at a time, Done early and its Undo, a reset of today, and a
 * finished session logged at once.
 */

/** One control at a time: a second tap waits for the first to land. */
let controls: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const next = controls.catch(() => undefined).then(work);
  controls = next.catch(() => undefined);
  return next;
}

function habitElement(elementId: string): HabitElement {
  const element = useElementStore.getState().elements.find((item) => item.id === elementId);
  if (!element || !isHabitElement(element)) throw new Error(`No timed habit ${elementId}`);
  return element;
}

/** What the core needs to play and show this habit's session. */
function startRequest(element: HabitElement): TimerStartRequest {
  const { config } = element;
  const { dailyTotals, dayMapsDate } = useEventStore.getState();
  const logged = dayMapsDate === todayDate() ? (dailyTotals[element.id] ?? 0) : 0;
  return {
    trackerId: element.id,
    name: element.name,
    lockScreenName: config.lockScreenName ?? null,
    iconKey: config.icon ?? null,
    goal: habitTimerGoal(config),
    trackId: hasHabitTimerSound(config.timerSound) ? (config.timerSound?.trackId?.trim() ?? null) : null,
    loop: getHabitTimerPlaybackMode(config.timerSound) === 'loop',
    loggedSeconds: Math.floor(logged),
  };
}

/** End the core's session and log it now; the copy the core queued is then a duplicate. */
async function finishAndLog(markComplete: boolean): Promise<TimerSessionRecord | null> {
  const record = await useEventStore.getState().finishHabitTimer(markComplete);
  if (record) await applyFinishedTimerSession(record);
  return record;
}

function alertFailure(titleKey: string, error: unknown): void {
  Alert.alert(
    i18n.t(titleKey),
    error instanceof Error ? error.message : i18n.t('common:errors.somethingWentWrong'),
  );
}

/**
 * Play starts or resumes, pause pauses: one tap, and the sound comes with
 * it. Another habit's session ends first, its seconds logged.
 */
export function pressHabitTimer(elementId: string): Promise<void> {
  return oneAtATime(async () => {
    const state = await lifeCore.getState();
    if (state?.trackerId === elementId && !state.pausedAt) {
      await useEventStore.getState().pauseHabitTimer();
      return;
    }
    if (state && state.trackerId !== elementId) await finishAndLog(false);
    await useEventStore.getState().startHabitTimer(startRequest(habitElement(elementId)));
  }).catch((error: unknown) => alertFailure('trackers:habitWidget.couldNotStartTimerTitle', error));
}

/**
 * Done on a timed habit: ends a running or paused session (its seconds
 * kept) and marks the day done even short of the goal. Resolves true when
 * Undo is worth offering.
 */
export function markHabitTimerDone(elementId: string, config: HabitConfig): Promise<boolean> {
  return oneAtATime(async () => {
    const state = await lifeCore.getState();
    if (state?.trackerId !== elementId) {
      return useEventStore.getState().markHabitDone(elementId, config);
    }
    const record = await finishAndLog(true);
    if (!record) return false;
    // The mark goes on the day the session's time ended.
    const endDay = toDateString(new Date(record.endedAt));
    return useEventStore.getState().isHabitDayDoneOnlyByMark(elementId, config, endDay);
  });
}

/** Undo for `markHabitTimerDone`: the day keeps its seconds and loses the mark. */
export function unmarkHabitTimerDone(elementId: string, config: HabitConfig): Promise<void> {
  return useEventStore.getState().unmarkHabitDone(elementId, config);
}

/** Clears today's time, banking a running session first; resolves to an Undo that puts it back. */
export function resetHabitTimerToday(
  elementId: string,
  config: HabitConfig,
): Promise<() => Promise<void>> {
  return oneAtATime(async () => {
    const date = todayDate();
    if ((await lifeCore.getState())?.trackerId === elementId) await finishAndLog(false);
    const removed = await useEventStore.getState().resetHabitToday(elementId, config, date);
    return () => useEventStore.getState().restoreHabitDay(elementId, config, removed, date);
  });
}

/**
 * The day changed: a session paused before today's midnight is finished,
 * its seconds going to the days they happened on. A running one runs on and
 * is split when it ends.
 */
export function finishTimerPausedBeforeToday(): Promise<void> {
  return oneAtATime(async () => {
    const state = await lifeCore.getState();
    if (!state?.pausedAt || toDateString(new Date(state.pausedAt)) >= todayDate()) return;
    await finishAndLog(false);
  });
}
