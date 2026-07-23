/** User-facing catalog of timer sounds bundled in the app. */
export type BundledHabitSound = {
  id: string;
  label: string;
  /** Approximate length of the bundled file (seconds), for play_once progress UI. */
  durationSeconds: number;
};

/**
 * Register tracks here after adding audio files under assets/sounds/
 * and mapping them in src/audio/bundledHabitSoundAssets.native.ts.
 */
export const BUNDLED_HABIT_SOUND_CATALOG: BundledHabitSound[] = [
  { id: 'meditation15min', label: 'Meditation 15 min', durationSeconds: 915 },
  { id: 'meditation30min', label: 'Meditation 30 min', durationSeconds: 1851 },
  { id: 'wimhofMorning', label: 'Wim Hof morning', durationSeconds: 1340 },
  { id: 'wimhofEvening', label: 'Wim Hof evening', durationSeconds: 935 },
];

export function isBundledHabitSoundId(trackId: string): boolean {
  return BUNDLED_HABIT_SOUND_CATALOG.some((track) => track.id === trackId);
}

export function getBundledHabitSoundLabel(trackId: string): string | undefined {
  return BUNDLED_HABIT_SOUND_CATALOG.find((track) => track.id === trackId)?.label;
}

export function getBundledHabitSoundDurationSeconds(
  trackId: string,
): number | undefined {
  return BUNDLED_HABIT_SOUND_CATALOG.find((track) => track.id === trackId)
    ?.durationSeconds;
}
