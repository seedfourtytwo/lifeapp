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
  type ActiveTimerSession,
  type HabitConfig,
} from '../protocol';
import { useEventStore } from '../store/eventStore';

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
      await stopHabitSound();
      await stopHabitTimer(elementId, config, undefined, { trackCompleted });
    },
    [stopHabitTimer],
  );

  const handleStartTimer = useCallback(
    (elementId: string, config: HabitConfig) => {
      startHabitTimer(elementId);
      playSoundForConfig(elementId, config, (id, cfg, trackCompleted) => {
        void handleFinishTimer(id, cfg, trackCompleted).catch((error) => {
          Alert.alert(
            'Could not finish timer',
            error instanceof Error ? error.message : 'Something went wrong',
          );
        });
      });
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
        void resumeHabitSound(config.timerSound);
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
      await stopHabitSound();
      await resetHabitToday(elementId, config);
    },
    [resetHabitToday],
  );

  return {
    handleTimerPress,
    handleFinishTimer,
    handleResetToday,
  };
}
