import type { SQLiteDatabase } from 'expo-sqlite';
import * as settingsRepo from './settingsRepository';
import {
  bumpCornerScore,
  CornerScoreSchema,
  cornerCountForDay,
  type CornerScore,
} from '../../weather/cornerScore';
import { toDateString } from '../../protocol';
import { withDbWriteLock } from '../writeLock';

export const WEATHER_CORNER_SCORE_KEY = 'weather_corner_score';

async function readStored(db: SQLiteDatabase): Promise<CornerScore | null> {
  const raw = await settingsRepo.getSetting(db, WEATHER_CORNER_SCORE_KEY);
  if (!raw) return null;
  try {
    const parsed = CornerScoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeStored(db: SQLiteDatabase, score: CornerScore): Promise<void> {
  await settingsRepo.setSetting(db, WEATHER_CORNER_SCORE_KEY, JSON.stringify(score));
}

/** Today's corner count (0 if a new day or never scored). */
export async function getTodayCornerCount(
  db: SQLiteDatabase,
  now = new Date(),
): Promise<number> {
  const today = toDateString(now);
  return cornerCountForDay(await readStored(db), today);
}

/** Persist +1 corner for today; returns the new daily total. Serialized so multi-corner bursts don't lose increments. */
export async function recordCornerHit(db: SQLiteDatabase, now = new Date()): Promise<number> {
  const today = toDateString(now);
  return withDbWriteLock(async () => {
    const next = bumpCornerScore(await readStored(db), today);
    await writeStored(db, next);
    return next.count;
  });
}

export async function clearCornerScore(db: SQLiteDatabase): Promise<void> {
  await settingsRepo.deleteSetting(db, WEATHER_CORNER_SCORE_KEY);
}
