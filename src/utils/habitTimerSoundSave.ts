import type { HabitTimerSound } from '../protocol';
import { buildHabitTimerSound } from '../protocol';

/** Normalize editor timer sound for persistence (sync — only stores a bundled track id). */
export function prepareHabitTimerSoundForSave(
  timerSound: HabitTimerSound | undefined,
): HabitTimerSound | undefined {
  if (!timerSound) return undefined;
  return buildHabitTimerSound({
    trackId: timerSound.trackId,
    playbackMode: timerSound.playbackMode,
  });
}
