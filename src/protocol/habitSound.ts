import { z } from 'zod';
import { i18n } from '../i18n';
import {
  getBundledHabitSoundLabel,
  isBundledHabitSoundId,
} from './habitSoundCatalog';

/** loop = play until user stops; play_once = timer ends when the track finishes. */
export const HabitTimerPlaybackModeSchema = z.enum(['loop', 'play_once']);

export type HabitTimerPlaybackMode = z.infer<typeof HabitTimerPlaybackModeSchema>;

/** Timer audio on the habit — bundled track id only. */
export const HabitTimerSoundSchema = z.object({
  trackId: z.string().optional(),
  playbackMode: HabitTimerPlaybackModeSchema.optional(),
});

export type HabitTimerSound = z.infer<typeof HabitTimerSoundSchema>;

export function getHabitTimerPlaybackMode(
  sound: HabitTimerSound | undefined,
): HabitTimerPlaybackMode {
  return sound?.playbackMode ?? 'loop';
}

export function hasHabitTimerSound(sound: HabitTimerSound | undefined): boolean {
  if (!sound) return false;
  const trackId = sound.trackId?.trim();
  return Boolean(trackId && isBundledHabitSoundId(trackId));
}

export function formatHabitTimerSoundSummary(sound: HabitTimerSound | undefined): string | null {
  if (!hasHabitTimerSound(sound) || !sound) return null;

  const parts: string[] = [];
  const trackId = sound.trackId?.trim();
  if (trackId) {
    parts.push(getBundledHabitSoundLabel(trackId) ?? trackId);
  }
  parts.push(
    getHabitTimerPlaybackMode(sound) === 'loop'
      ? i18n.t('trackers:habitSoundFields.loopsSummary')
      : i18n.t('trackers:habitSoundFields.trackLength'),
  );
  return parts.join(' · ');
}

export function buildHabitTimerSound(input: {
  trackId?: string;
  playbackMode?: HabitTimerPlaybackMode;
}): HabitTimerSound | undefined {
  const trackId = input.trackId?.trim() || undefined;
  if (!trackId || !isBundledHabitSoundId(trackId)) return undefined;

  return {
    trackId,
    ...(input.playbackMode ? { playbackMode: input.playbackMode } : {}),
  };
}
