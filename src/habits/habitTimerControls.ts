import { Alert } from 'react-native';
import {
  pauseHabitSound,
  playHabitSound,
  resumeHabitSound,
  stopHabitSound,
} from '../audio/habitTimerSound';
import {
  getHabitTimerPlaybackMode,
  hasHabitTimerSound,
  isActiveTimerPaused,
  parseHabitConfig,
  type ActiveTimerSession,
  type HabitConfig,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore, whenActiveTimersReady } from '../store/eventStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import {
  getFocusedHabitId,
  peekAdjacentHabit,
  setFocusedHabitId,
} from './habitLockScreenQueue';
import {
  lockScreenMetaFor,
  presentFocusedHabitReady,
  refreshLockScreenTicker,
} from './habitTimerPresentation';
import { stopHabitTimerLockScreenTicker } from './habitTimerLockScreen';

function playSoundForConfig(
  elementId: string,
  config: HabitConfig,
  onFinish: (elementId: string, config: HabitConfig, trackCompleted?: boolean) => void,
): Promise<void> {
  setFocusedHabitId(elementId);
  return playHabitSound(config.timerSound, {
    lockScreen: lockScreenMetaFor(elementId, config),
    onEnded:
      hasHabitTimerSound(config.timerSound) &&
      getHabitTimerPlaybackMode(config.timerSound) === 'play_once'
        ? () => {
            onFinish(elementId, config, true);
          }
        : undefined,
  }).then(() => {
    refreshLockScreenTicker();
  });
}

async function finalizeOtherTimers(exceptElementId: string): Promise<void> {
  const sessions = useEventStore.getState().activeTimerSessions;
  const otherIds = Object.keys(sessions).filter((id) => id !== exceptElementId);
  if (otherIds.length === 0) return;

  await stopHabitSound();
  stopHabitTimerLockScreenTicker();
  const stopHabitTimer = useEventStore.getState().stopHabitTimer;
  const discardHabitTimer = useEventStore.getState().discardHabitTimer;
  const elements = useElementStore.getState().elements;

  for (const id of otherIds) {
    const element = elements.find((item) => item.id === id && item.kind === 'habit');
    if (element) {
      try {
        await stopHabitTimer(id, parseHabitConfig(element.config));
      } catch (error) {
        console.warn('Failed to finalize previous timer', error);
        discardHabitTimer(id);
      }
    } else {
      discardHabitTimer(id);
    }
  }
}

let timerStartChain: Promise<void> = Promise.resolve();

function enqueueTimerStart(work: () => Promise<void>): Promise<void> {
  const next = timerStartChain.catch(() => undefined).then(work);
  timerStartChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function finishHabitTimer(
  elementId: string,
  config: HabitConfig,
  trackCompleted = false,
  options?: { advance?: boolean; playChime?: boolean },
): Promise<void> {
  const date = currentAppCalendarDate();
  stopHabitTimerLockScreenTicker();
  await stopHabitSound();
  await useEventStore.getState().stopHabitTimer(elementId, config, date, {
    trackCompleted,
    playChime: options?.playChime,
  });

  if (options?.advance === false) {
    return;
  }

  const next = peekAdjacentHabit('next');
  if (next && next.element.id !== elementId) {
    setFocusedHabitId(next.element.id);
  } else {
    setFocusedHabitId(elementId);
  }
  await presentFocusedHabitReady();
}

export function startHabitTimerSession(elementId: string, config: HabitConfig): void {
  void enqueueTimerStart(async () => {
    try {
      // Wait for persisted-session hydrate + day totals so starts/finishes are consistent.
      await whenActiveTimersReady();
      const existing = useEventStore.getState().activeTimerSessions[elementId];
      if (existing) {
        if (isActiveTimerPaused(existing)) {
          resumeHabitTimerSession(elementId, config);
        }
        return;
      }
      await finalizeOtherTimers(elementId);
      if (useEventStore.getState().activeTimerSessions[elementId]) return;
      setFocusedHabitId(elementId);
      useEventStore.getState().startHabitTimer(elementId);
      playSoundForConfig(elementId, config, (id, cfg, trackCompleted) => {
        void finishHabitTimer(id, cfg, trackCompleted, {
          playChime: trackCompleted === true,
        }).catch((error) => {
          Alert.alert(
            'Could not finish timer',
            error instanceof Error ? error.message : 'Something went wrong',
          );
        });
      });
    } catch (error) {
      Alert.alert(
        'Could not start timer',
        error instanceof Error ? error.message : 'Something went wrong',
      );
    }
  });
}

export function pauseHabitTimerSession(elementId: string, _config: HabitConfig): void {
  useEventStore.getState().pauseHabitTimer(elementId);
  void pauseHabitSound();
  refreshLockScreenTicker();
}

export function resumeHabitTimerSession(elementId: string, config: HabitConfig): void {
  useEventStore.getState().resumeHabitTimer(elementId);
  const lockScreen = lockScreenMetaFor(elementId, config);
  if (hasHabitTimerSound(config.timerSound)) {
    const playbackMode = getHabitTimerPlaybackMode(config.timerSound);
    void resumeHabitSound(config.timerSound, {
      lockScreen,
      onEnded:
        playbackMode === 'play_once'
          ? () => {
              void finishHabitTimer(elementId, config, true, { playChime: true }).catch(
                (error) => {
                  Alert.alert(
                    'Could not finish timer',
                    error instanceof Error ? error.message : 'Something went wrong',
                  );
                },
              );
            }
          : undefined,
    }).then(() => refreshLockScreenTicker());
  } else {
    playSoundForConfig(elementId, config, (id, cfg, trackCompleted) => {
      void finishHabitTimer(id, cfg, trackCompleted, {
        playChime: trackCompleted === true,
      }).catch((error) => {
        Alert.alert(
          'Could not finish timer',
          error instanceof Error ? error.message : 'Something went wrong',
        );
      });
    });
  }
}

export function pressHabitTimer(elementId: string, config: HabitConfig): void {
  const session: ActiveTimerSession | undefined =
    useEventStore.getState().activeTimerSessions[elementId];
  if (!session) {
    startHabitTimerSession(elementId, config);
    return;
  }
  if (isActiveTimerPaused(session)) {
    resumeHabitTimerSession(elementId, config);
    return;
  }
  pauseHabitTimerSession(elementId, config);
}

export async function resetHabitTimerToday(
  elementId: string,
  config: HabitConfig,
): Promise<void> {
  const date = currentAppCalendarDate();
  stopHabitTimerLockScreenTicker();
  await stopHabitSound();
  await useEventStore.getState().resetHabitToday(elementId, config, date);
  if (getFocusedHabitId() === elementId) {
    await presentFocusedHabitReady();
  }
}

export { playSoundForConfig };
