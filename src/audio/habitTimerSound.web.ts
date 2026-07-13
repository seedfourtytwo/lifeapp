import type { HabitTimerSound } from '../protocol/habitSound';

export type HabitSoundPlaybackOptions = {
  onEnded?: () => void;
};

/** Bundled timer sounds play on native only; web preview is a no-op. */
export async function warmupHabitSoundPlayback(): Promise<void> {}

export async function preloadHabitSound(_sound?: HabitTimerSound): Promise<boolean> {
  return false;
}

export function isHabitSoundCached(_sound?: HabitTimerSound): boolean {
  return false;
}

export async function playHabitSound(
  _sound?: HabitTimerSound,
  _options?: HabitSoundPlaybackOptions,
): Promise<boolean> {
  return false;
}

export async function pauseHabitSound(): Promise<void> {}

export async function resumeHabitSound(_sound?: HabitTimerSound): Promise<boolean> {
  return false;
}

export async function stopHabitSound(): Promise<void> {}
