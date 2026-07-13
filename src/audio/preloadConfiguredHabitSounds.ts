import type { ElementDefinition } from '../protocol';
import { hasHabitTimerSound, parseHabitConfig } from '../protocol';
import {
  isHabitSoundCached,
  preloadHabitSound,
} from './habitTimerSound';

const PRELOAD_CONCURRENCY = 2;

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

/** Preload bundled timer sounds for pinned timer habits (parallel, deduped). */
export async function preloadConfiguredHabitSounds(
  elements: ElementDefinition[],
): Promise<void> {
  const seenTrackIds = new Set<string>();
  const soundsToPreload = [];

  for (const element of elements) {
    if (element.kind !== 'habit') continue;

    const parsed = parseHabitConfig(element.config);
    if (!hasHabitTimerSound(parsed.timerSound)) continue;

    const timerSound = parsed.timerSound;
    const trackId = timerSound?.trackId?.trim();
    if (!trackId || seenTrackIds.has(trackId)) continue;
    seenTrackIds.add(trackId);

    if (isHabitSoundCached(timerSound)) continue;
    soundsToPreload.push(timerSound);
  }

  await mapWithConcurrency(soundsToPreload, PRELOAD_CONCURRENCY, async (sound) => {
    await preloadHabitSound(sound);
  });
}
