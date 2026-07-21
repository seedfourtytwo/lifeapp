import type { HabitTimerSound } from '../protocol/habitSound';

export type HabitTimerLockScreenMeta = {
  title?: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

export type HabitSoundPlaybackOptions = {
  onEnded?: () => void;
  lockScreen?: HabitTimerLockScreenMeta;
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

export async function resumeHabitSound(
  _sound?: HabitTimerSound,
  _options?: HabitSoundPlaybackOptions,
): Promise<boolean> {
  return false;
}

export async function stopHabitSound(): Promise<void> {}

export function setHabitTimerRemoteHandlers(_handlers: {
  onPlayingChange?: ((playing: boolean) => void) | null;
  onSkip?: ((direction: 'next' | 'prev') => void) | null;
}): void {}

export function updateHabitTimerLockScreen(_metadata: HabitTimerLockScreenMeta): void {}

export function clearHabitTimerLockScreen(): void {}

export function isHabitTimerSoundUserPaused(): boolean {
  return false;
}
