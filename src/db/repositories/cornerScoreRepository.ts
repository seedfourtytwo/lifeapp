import { getDatabase } from '../client';
import * as settingsRepo from './settingsRepository';
import {
  bumpCornerScore,
  CornerScoreSchema,
  cornerCountForDay,
  type CornerScore,
} from '../../weather/cornerScore';
import { toDateString } from '../../protocol';

export const WEATHER_CORNER_SCORE_KEY = 'weather_corner_score';

/** Serialize read→bump→write so multi-corner bursts don't lose increments. */
let writeChain: Promise<unknown> = Promise.resolve();

async function readStored(): Promise<CornerScore | null> {
  const db = await getDatabase();
  const raw = await settingsRepo.getSetting(db, WEATHER_CORNER_SCORE_KEY);
  if (!raw) return null;
  try {
    const parsed = CornerScoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeStored(score: CornerScore): Promise<void> {
  const db = await getDatabase();
  await settingsRepo.setSetting(db, WEATHER_CORNER_SCORE_KEY, JSON.stringify(score));
}

/** Today's corner count (0 if a new day or never scored). */
export async function getTodayCornerCount(now = new Date()): Promise<number> {
  const today = toDateString(now);
  return cornerCountForDay(await readStored(), today);
}

/** Persist +1 corner for today; returns the new daily total. */
export async function recordCornerHit(now = new Date()): Promise<number> {
  const today = toDateString(now);
  const run = writeChain.then(async () => {
    const next = bumpCornerScore(await readStored(), today);
    await writeStored(next);
    return next.count;
  });
  // Keep the chain alive even if one write fails.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function clearCornerScore(): Promise<void> {
  const db = await getDatabase();
  await settingsRepo.deleteSetting(db, WEATHER_CORNER_SCORE_KEY);
}
