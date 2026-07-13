/** User-facing catalog of timer sounds bundled in the app. */
export type BundledHabitSound = {
  id: string;
  label: string;
};

/**
 * Register tracks here after adding audio files under assets/sounds/
 * and mapping them in src/audio/bundledHabitSoundAssets.native.ts.
 */
export const BUNDLED_HABIT_SOUND_CATALOG: BundledHabitSound[] = [
  { id: 'meditation15min', label: 'Meditation 15 min' },
  { id: 'meditation30min', label: 'Meditation 30 min' },
  { id: 'wimhofMorning', label: 'Wim Hof morning' },
  { id: 'wimhofEvening', label: 'Wim Hof evening' },
];

export function isBundledHabitSoundId(trackId: string): boolean {
  return BUNDLED_HABIT_SOUND_CATALOG.some((track) => track.id === trackId);
}

export function getBundledHabitSoundLabel(trackId: string): string | undefined {
  return BUNDLED_HABIT_SOUND_CATALOG.find((track) => track.id === trackId)?.label;
}
