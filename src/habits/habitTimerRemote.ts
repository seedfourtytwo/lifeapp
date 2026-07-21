import { Alert } from 'react-native';
import {
  pauseHabitSound,
  playHabitSound,
  setHabitTimerRemoteHandlers,
  stopHabitSound,
} from '../audio/habitTimerSound';
import { getHabitTimerPlaybackMode, isActiveTimerPaused } from '../protocol';
import { useEventStore, whenActiveTimersReady } from '../store/eventStore';
import {
  peekAdjacentHabit,
  resolveFocusedHabit,
  setFocusedHabitId,
} from './habitLockScreenQueue';
import {
  finishHabitTimer,
  pauseHabitTimerSession,
  playSoundForConfig,
  resumeHabitTimerSession,
  startHabitTimerSession,
} from './habitTimerControls';
import {
  presentFocusedHabitReady,
  refreshLockScreenTicker,
} from './habitTimerPresentation';
import { buildHabitTimerLockScreenMeta } from './habitTimerLockScreenMeta';
import { stopHabitTimerLockScreenTicker } from './habitTimerLockScreen';

let skipChain: Promise<void> = Promise.resolve();

function enqueueSkip(work: () => Promise<void>): Promise<void> {
  const next = skipChain.catch(() => undefined).then(work);
  skipChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function startOrToggleFocusedHabit(): Promise<void> {
  await whenActiveTimersReady();
  const focused = resolveFocusedHabit();
  if (!focused) return;
  const { element, config } = focused;

  if (config.trackingMode === 'timer') {
    const session = useEventStore.getState().activeTimerSessions[element.id];
    if (!session) {
      startHabitTimerSession(element.id, config);
      return;
    }
    if (isActiveTimerPaused(session)) {
      resumeHabitTimerSession(element.id, config);
    }
    return;
  }

  try {
    await useEventStore.getState().toggleHabit(element.id, config);
    const next = peekAdjacentHabit('next');
    if (next) {
      setFocusedHabitId(next.element.id);
    }
    await presentFocusedHabitReady();
  } catch (error) {
    Alert.alert(
      'Could not update habit',
      error instanceof Error ? error.message : 'Something went wrong',
    );
  }
}

/**
 * Scroll lock-screen focus. Finishes any active timer on the habit we leave
 * so the morning routine can advance without unlocking.
 */
async function skipHabit(direction: 'next' | 'prev'): Promise<void> {
  const current = resolveFocusedHabit();
  if (!current) return;

  const session = useEventStore.getState().activeTimerSessions[current.element.id];
  if (session) {
    try {
      await finishHabitTimer(current.element.id, current.config, false, { advance: false });
    } catch (error) {
      Alert.alert(
        'Could not finish timer',
        error instanceof Error ? error.message : 'Something went wrong',
      );
      return;
    }
  }

  const adjacent = peekAdjacentHabit(direction);
  if (!adjacent) {
    await presentFocusedHabitReady();
    return;
  }
  setFocusedHabitId(adjacent.element.id);
  await presentFocusedHabitReady();
}

/**
 * Wire OS media transport (lock screen / headset) to habit controls.
 * Call once at app bootstrap.
 *
 * - Play / Pause: start, pause, or resume the focused habit
 * - Seek forward / back: next / previous habit (finishes a running timer first)
 */
export function installHabitTimerRemoteControls(): void {
  setHabitTimerRemoteHandlers({
    onPlayingChange: (playing) => {
      const focused = resolveFocusedHabit();
      if (!focused) return;
      const { element, config } = focused;
      const session = useEventStore.getState().activeTimerSessions[element.id];

      if (playing) {
        if (!session) {
          void startOrToggleFocusedHabit();
          return;
        }
        // Paused or OS-interrupted while session still "running" — (re)start audio.
        resumeHabitTimerSession(element.id, config);
        return;
      }

      if (!session) return;

      if (!isActiveTimerPaused(session)) {
        pauseHabitTimerSession(element.id, config);
      }
    },
    onSkip: (direction) => {
      void enqueueSkip(() => skipHabit(direction));
    },
  });
}

/**
 * After restoring persisted sessions, resume media + lock screen for the active timer.
 */
export async function restoreHabitTimerPlaybackAfterHydration(): Promise<void> {
  const sessions = useEventStore.getState().activeTimerSessions;
  const elementId = Object.keys(sessions)[0];
  if (!elementId) {
    return;
  }

  setFocusedHabitId(elementId);
  const resolved = resolveFocusedHabit();
  if (!resolved) return;
  const { element, config } = resolved;
  const session = sessions[element.id];
  if (!session) return;

  const startedAt = session.startedAt;
  const lockScreen = buildHabitTimerLockScreenMeta(element.name, session, config);

  if (isActiveTimerPaused(session)) {
    await playHabitSound(config.timerSound, { lockScreen });
  } else if (getHabitTimerPlaybackMode(config.timerSound) === 'play_once') {
    // Don't restart a play-once track from 0 after process death — keepalive owns
    // the lock screen; elapsed time already lives in the persisted session.
    await playHabitSound(undefined, { lockScreen });
  } else {
    await playSoundForConfig(element.id, config, (id, cfg, trackCompleted) => {
      void finishHabitTimer(id, cfg, trackCompleted).catch((error) => {
        Alert.alert(
          'Could not finish timer',
          error instanceof Error ? error.message : 'Something went wrong',
        );
      });
    });
  }

  const latest = useEventStore.getState().activeTimerSessions[element.id];
  if (!latest || latest.startedAt !== startedAt) {
    // Session finished/replaced while audio was starting.
    await stopHabitSound();
    stopHabitTimerLockScreenTicker();
    return;
  }
  if (isActiveTimerPaused(latest)) {
    await pauseHabitSound();
  }
  refreshLockScreenTicker();
}
