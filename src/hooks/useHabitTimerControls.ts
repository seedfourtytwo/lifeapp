import { useCallback } from 'react';
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
import { useEventStore } from '../store/eventStore';
import { currentAppCalendarDate } from '../utils/dayRollover';

function playSoundForConfig(
  elementId: string,
  config: HabitConfig,
  onFinish: (elementId: string, config: HabitConfig, trackCompleted?: boolean) => void,
): void {
  if (!hasHabitTimerSound(config.timerSound)) return;

  const playbackMode = getHabitTimerPlaybackMode(config.timerSound);
  void playHabitSound(config.timerSound, {
    onEnded:
      playbackMode === 'play_once'
        ? () => {
            onFinish(elementId, config, true);
          }
        : undefined,
  });
}

async function finalizeOtherTimers(exceptElementId: string): Promise<void> {
  const sessions = useEventStore.getState().activeTimerSessions;
  const otherIds = Object.keys(sessions).filter((id) => id !== exceptElementId);
  if (otherIds.length === 0) return;

  await stopHabitSound();
  const elements = useElementStore.getState().elements;
  const stopHabitTimer = useEventStore.getState().stopHabitTimer;
  const discardHabitTimer = useEventStore.getState().discardHabitTimer;

  for (const id of otherIds) {
    const element = elements.find((item) => item.id === id);
    if (element?.kind === 'habit') {
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

/** Couples habit timer store actions with bundled sound playback. */
export function useHabitTimerControls() {
  const activeTimerSessions = useEventStore((s) => s.activeTimerSessions);
  const startHabitTimer = useEventStore((s) => s.startHabitTimer);
  const pauseHabitTimer = useEventStore((s) => s.pauseHabitTimer);
  const resumeHabitTimer = useEventStore((s) => s.resumeHabitTimer);
  const stopHabitTimer = useEventStore((s) => s.stopHabitTimer);
  const resetHabitToday = useEventStore((s) => s.resetHabitToday);

  const handleFinishTimer = useCallback(
    async (elementId: string, config: HabitConfig, trackCompleted = false) => {
      // Capture before any await — sound teardown can cross midnight.
      const date = currentAppCalendarDate();
      await stopHabitSound();
      await stopHabitTimer(elementId, config, date, { trackCompleted });
    },
    [stopHabitTimer],
  );

  const handleStartTimer = useCallback(
    (elementId: string, config: HabitConfig) => {
      void (async () => {
        try {
          await finalizeOtherTimers(elementId);
          startHabitTimer(elementId);
          playSoundForConfig(elementId, config, (id, cfg, trackCompleted) => {
            void handleFinishTimer(id, cfg, trackCompleted).catch((error) => {
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
      })();
    },
    [handleFinishTimer, startHabitTimer],
  );

  const handlePauseTimer = useCallback(
    (elementId: string, config: HabitConfig) => {
      pauseHabitTimer(elementId);
      if (hasHabitTimerSound(config.timerSound)) {
        void pauseHabitSound();
      }
    },
    [pauseHabitTimer],
  );

  const handleResumeTimer = useCallback(
    (elementId: string, config: HabitConfig) => {
      resumeHabitTimer(elementId);
      if (hasHabitTimerSound(config.timerSound)) {
        const playbackMode = getHabitTimerPlaybackMode(config.timerSound);
        void resumeHabitSound(config.timerSound, {
          onEnded:
            playbackMode === 'play_once'
              ? () => {
                  void handleFinishTimer(elementId, config, true).catch((error) => {
                    Alert.alert(
                      'Could not finish timer',
                      error instanceof Error ? error.message : 'Something went wrong',
                    );
                  });
                }
              : undefined,
        });
      } else {
        playSoundForConfig(elementId, config, (id, cfg, trackCompleted) => {
          void handleFinishTimer(id, cfg, trackCompleted).catch((error) => {
            Alert.alert(
              'Could not finish timer',
              error instanceof Error ? error.message : 'Something went wrong',
            );
          });
        });
      }
    },
    [handleFinishTimer, resumeHabitTimer],
  );

  const handleTimerPress = useCallback(
    (elementId: string, config: HabitConfig) => {
      const session: ActiveTimerSession | undefined = activeTimerSessions[elementId];
      if (!session) {
        handleStartTimer(elementId, config);
        return;
      }
      if (isActiveTimerPaused(session)) {
        handleResumeTimer(elementId, config);
        return;
      }
      handlePauseTimer(elementId, config);
    },
    [
      activeTimerSessions,
      handlePauseTimer,
      handleResumeTimer,
      handleStartTimer,
    ],
  );

  const handleResetToday = useCallback(
    async (elementId: string, config: HabitConfig) => {
      const date = currentAppCalendarDate();
      await stopHabitSound();
      await resetHabitToday(elementId, config, date);
    },
    [resetHabitToday],
  );

  return {
    handleTimerPress,
    handleFinishTimer,
    handleResetToday,
  };
}
