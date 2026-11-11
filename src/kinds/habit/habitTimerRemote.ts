import { Alert } from 'react-native';
import {
  pauseHabitSound,
  playHabitSound,
  setHabitTimerRemoteHandlers,
  stopHabitSound,
} from '../../audio/habitTimerSound';
import { ensureCurrentDay } from '../../hooks/ensureCurrentDay';
import { i18n } from '../../i18n';
import { getHabitTimerPlaybackMode, isActiveTimerPaused } from '../../protocol';
import { useEventStore, whenActiveTimersReady } from '../../store/eventStore';
import {
  getFocusedHabitId,
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
    // A button press on a locked phone only ever completes — it must not
    // silently un-tick a habit that is already done.
    await useEventStore.getState().completeHabit(element.id, config);
    const next = peekAdjacentHabit('next');
    if (next) {
      setFocusedHabitId(next.element.id);
    }
    await presentFocusedHabitReady();
  } catch (error) {
    Alert.alert(
      i18n.t('trackers:habitWidget.couldNotUpdateTitle'),
      error instanceof Error ? error.message : i18n.t('common:errors.somethingWentWrong'),
    );
  }
}

/**
 * Scroll lock-screen focus. Finishes any active timer on the habit we leave
 * so the morning routine can advance without unlocking.
 */
async function skipHabit(direction: 'next' | 'prev'): Promise<void> {
  try {
    await ensureCurrentDay();
  } catch (error) {
    // Acting on yesterday's queue could finish or focus the wrong habit; the
    // rollover retries on the next foreground.
    console.warn('Lock-screen skip ignored: day rollover failed', error);
    return;
  }
  const current = resolveFocusedHabit();
  if (!current) return;

  const session = useEventStore.getState().activeTimerSessions[current.element.id];
  if (session) {
    try {
      await finishHabitTimer(current.element.id, current.config, false, { advance: false });
    } catch (error) {
      Alert.alert(
        i18n.t('trackers:habitWidget.couldNotFinishTimerTitle'),
        error instanceof Error ? error.message : i18n.t('common:errors.somethingWentWrong'),
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
 * - Playback progress / end: the running timer's heartbeat, and its loss
 */
export function installHabitTimerRemoteControls(): void {
  setHabitTimerRemoteHandlers({
    // The player only ever plays for the focused habit: playing a session's
    // sound focuses it, and skipping away finishes the running timer first.
    onPlaybackProgress: () => {
      const focused = getFocusedHabitId();
      if (focused) useEventStore.getState().recordTimerHeartbeat(focused);
    },
    onPlaybackEnded: () => useEventStore.getState().clearTimerHeartbeats(),
    onPlayingChange: (playing) => {
      void (async () => {
        // A locked phone may have slept through midnight; act on today's maps.
        await ensureCurrentDay();
        const focused = resolveFocusedHabit();
        if (!focused) return;
        const { element, config } = focused;
        const session = useEventStore.getState().activeTimerSessions[element.id];

        if (playing) {
          if (!session) {
            await startOrToggleFocusedHabit();
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
      })().catch((error) => {
        console.warn('Lock-screen play/pause failed', error);
      });
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
      void finishHabitTimer(id, cfg, trackCompleted, {
        playChime: trackCompleted === true,
      }).catch((error) => {
        Alert.alert(
          i18n.t('trackers:habitWidget.couldNotFinishTimerTitle'),
          error instanceof Error ? error.message : i18n.t('common:errors.somethingWentWrong'),
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
