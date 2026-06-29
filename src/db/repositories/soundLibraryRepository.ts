import type { SQLiteDatabase } from 'expo-sqlite';
import { parseSoundLibrary, type SoundAsset } from '../../protocol/sound';
import * as settingsRepo from './settingsRepository';

const SOUND_LIBRARY_KEY = 'sound_library';

export async function getSoundLibrary(db: SQLiteDatabase): Promise<SoundAsset[]> {
  const raw = await settingsRepo.getSetting(db, SOUND_LIBRARY_KEY);
  if (!raw) {
    return [];
  }
  return parseSoundLibrary(JSON.parse(raw));
}

export async function setSoundLibrary(
  db: SQLiteDatabase,
  sounds: SoundAsset[],
): Promise<void> {
  await settingsRepo.setSetting(db, SOUND_LIBRARY_KEY, JSON.stringify(sounds));
}

export async function addSoundAsset(
  db: SQLiteDatabase,
  asset: SoundAsset,
): Promise<SoundAsset[]> {
  const sounds = await getSoundLibrary(db);
  const next = [...sounds, asset];
  await setSoundLibrary(db, next);
  return next;
}

export async function removeSoundAsset(
  db: SQLiteDatabase,
  id: string,
): Promise<SoundAsset[]> {
  const sounds = await getSoundLibrary(db);
  const next = sounds.filter((sound) => sound.id !== id);
  await setSoundLibrary(db, next);
  return next;
}
