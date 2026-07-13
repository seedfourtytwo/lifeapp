import type { HabitTimerSound } from '../protocol/habitSound';
import { getBundledHabitSoundModule } from './bundledHabitSoundAssets';

export type HabitTimerPlaybackSource = { type: 'bundled'; moduleId: number };

export async function resolveHabitTimerPlaybackSource(
  sound: HabitTimerSound,
): Promise<HabitTimerPlaybackSource | null> {
  const trackId = sound.trackId?.trim();
  if (!trackId) return null;

  const moduleId = getBundledHabitSoundModule(trackId);
  if (moduleId === undefined) return null;

  return { type: 'bundled', moduleId };
}
