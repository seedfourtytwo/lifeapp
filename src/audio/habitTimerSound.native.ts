import { AppState, type AppStateStatus } from 'react-native';
import type { HabitTimerSound } from '../protocol/habitSound';
import { getHabitTimerPlaybackMode } from '../protocol/habitSound';
import { getBundledHabitSoundModule } from './bundledHabitSoundAssets';
import {
  resolveHabitTimerPlaybackSource,
  type HabitTimerPlaybackSource,
} from './habitTimerPlayback';

type AvSound = import('expo-av').Audio.Sound;
type AvAudio = typeof import('expo-av').Audio;

export type HabitSoundPlaybackOptions = {
  onEnded?: () => void;
};

let activeSound: AvSound | null = null;
let activeSourceKey: string | null = null;
let activeLooping = true;
let audioModule: AvAudio | null = null;
let audioUnavailable = false;
let audioModeReady = false;
let backgroundPlaybackEnabled = false;
let userPausedPlayback = false;
let playbackEpoch = 0;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

const loadedSounds = new Map<string, AvSound>();
const loadingSounds = new Map<string, Promise<AvSound | null>>();

function sourceKey(source: HabitTimerPlaybackSource): string {
  return `bundled:${source.moduleId}`;
}

function isPlaybackStale(epoch: number): boolean {
  return epoch !== playbackEpoch;
}

async function getAudio(): Promise<AvAudio | null> {
  if (audioUnavailable) {
    return null;
  }
  if (audioModule) {
    return audioModule;
  }

  try {
    const { Audio } = await import('expo-av');
    audioModule = Audio;
    return audioModule;
  } catch (error) {
    audioUnavailable = true;
    console.warn(
      'expo-av is unavailable; timer sounds disabled until you rebuild the dev client.',
      error,
    );
    return null;
  }
}

async function ensureAudioMode(Audio: AvAudio, forBackgroundPlayback: boolean): Promise<void> {
  if (audioModeReady && backgroundPlaybackEnabled === forBackgroundPlayback) {
    return;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: forBackgroundPlayback,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  audioModeReady = true;
  backgroundPlaybackEnabled = forBackgroundPlayback;
}

function ensureAppStateResumeListener(): void {
  if (appStateSubscription) return;

  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void resumeActiveSoundIfInterrupted();
    }
  });
}

async function resumeActiveSoundIfInterrupted(): Promise<void> {
  if (!activeSound || userPausedPlayback) return;

  try {
    const status = await activeSound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying && status.positionMillis > 0) {
      await activeSound.playAsync();
    }
  } catch {
    // Playback may have been torn down by the OS.
  }
}

async function releaseBackgroundAudioMode(): Promise<void> {
  const Audio = await getAudio();
  if (!Audio || !backgroundPlaybackEnabled) return;

  await ensureAudioMode(Audio, false);
}

async function loadSoundIntoCache(source: HabitTimerPlaybackSource): Promise<AvSound | null> {
  const key = sourceKey(source);
  const cached = loadedSounds.get(key);
  if (cached) return cached;

  const inFlight = loadingSounds.get(key);
  if (inFlight) return inFlight;

  const loadPromise = (async () => {
    const Audio = await getAudio();
    if (!Audio) return null;

    await ensureAudioMode(Audio, false);

    const { sound } = await Audio.Sound.createAsync(source.moduleId, {
      shouldPlay: false,
      volume: 1,
    });
    loadedSounds.set(key, sound);
    return sound;
  })();

  loadingSounds.set(key, loadPromise);
  try {
    return await loadPromise;
  } finally {
    loadingSounds.delete(key);
  }
}

function attachEndedHandler(sound: AvSound, loop: boolean, onEnded?: () => void): void {
  sound.setOnPlaybackStatusUpdate(null);
  if (loop || !onEnded) return;

  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !status.didJustFinish || status.isLooping) {
      return;
    }
    void stopHabitSound();
    onEnded();
  });
}

async function pauseSound(sound: AvSound, resetPosition: boolean): Promise<void> {
  const status = await sound.getStatusAsync();
  if (status.isLoaded && status.isPlaying) {
    await sound.pauseAsync();
  }
  if (resetPosition && status.isLoaded) {
    await sound.setPositionAsync(0);
  }
}

async function playSource(
  source: HabitTimerPlaybackSource,
  loop: boolean,
  onEnded: (() => void) | undefined,
  requestEpoch: number,
  resumeIfPaused = true,
): Promise<boolean> {
  if (isPlaybackStale(requestEpoch)) return false;

  const sound = await loadSoundIntoCache(source);
  if (!sound || isPlaybackStale(requestEpoch)) return false;

  const key = sourceKey(source);
  const status = await sound.getStatusAsync();
  if (
    resumeIfPaused &&
    activeSourceKey === key &&
    activeSound === sound &&
    activeLooping === loop &&
    status.isLoaded &&
    !status.isPlaying &&
    status.positionMillis > 0
  ) {
    await sound.playAsync();
    return true;
  }

  if (activeSourceKey === key && activeSound === sound && activeLooping === loop) {
    if (status.isLoaded && status.isPlaying) {
      return true;
    }
  }

  if (activeSound && activeSound !== sound) {
    try {
      await pauseSound(activeSound, true);
    } catch {
      // Sound may already be unloaded.
    }
    activeSound = null;
    activeSourceKey = null;
    activeLooping = true;
  }

  if (isPlaybackStale(requestEpoch)) return false;

  const Audio = await getAudio();
  if (!Audio) return false;

  await ensureAudioMode(Audio, true);
  ensureAppStateResumeListener();

  await sound.setIsLoopingAsync(loop);
  attachEndedHandler(sound, loop, onEnded);
  await sound.setPositionAsync(0);
  if (isPlaybackStale(requestEpoch)) return false;

  await sound.playAsync();
  if (isPlaybackStale(requestEpoch)) {
    await pauseSound(sound, true);
    return false;
  }

  activeSound = sound;
  activeSourceKey = key;
  activeLooping = loop;
  return true;
}

export async function warmupHabitSoundPlayback(): Promise<void> {
  const Audio = await getAudio();
  if (!Audio) return;
  await ensureAudioMode(Audio, false);
}

export async function preloadHabitSound(sound?: HabitTimerSound): Promise<boolean> {
  if (!sound) return false;
  const source = await resolveHabitTimerPlaybackSource(sound);
  if (!source) return false;
  return Boolean(await loadSoundIntoCache(source));
}

export function isHabitSoundCached(sound?: HabitTimerSound): boolean {
  const trackId = sound?.trackId?.trim();
  if (!trackId) return false;
  const moduleId = getBundledHabitSoundModule(trackId);
  if (moduleId === undefined) return false;
  return loadedSounds.has(`bundled:${moduleId}`);
}

export async function playHabitSound(
  sound?: HabitTimerSound,
  options?: HabitSoundPlaybackOptions,
): Promise<boolean> {
  if (!sound) return false;

  const requestEpoch = ++playbackEpoch;
  const source = await resolveHabitTimerPlaybackSource(sound);
  if (!source || isPlaybackStale(requestEpoch)) return false;

  const loop = getHabitTimerPlaybackMode(sound) === 'loop';
  userPausedPlayback = false;
  return playSource(source, loop, options?.onEnded, requestEpoch, true);
}

export async function pauseHabitSound(): Promise<void> {
  userPausedPlayback = true;
  if (!activeSound) return;
  try {
    await pauseSound(activeSound, false);
  } catch {
    // Sound may already be unloaded.
  }
}

export async function resumeHabitSound(
  sound?: HabitTimerSound,
  options?: HabitSoundPlaybackOptions,
): Promise<boolean> {
  if (!sound) return false;

  userPausedPlayback = false;

  if (activeSound) {
    const status = await activeSound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      const loop = getHabitTimerPlaybackMode(sound) === 'loop';
      attachEndedHandler(activeSound, loop, options?.onEnded);
      await activeSound.playAsync();
      return true;
    }
  }

  const requestEpoch = ++playbackEpoch;
  const source = await resolveHabitTimerPlaybackSource(sound);
  if (!source || isPlaybackStale(requestEpoch)) return false;

  const loop = getHabitTimerPlaybackMode(sound) === 'loop';
  return playSource(source, loop, options?.onEnded, requestEpoch, true);
}

export async function stopHabitSound(): Promise<void> {
  playbackEpoch += 1;
  userPausedPlayback = false;

  if (!activeSound) {
    activeSourceKey = null;
    return;
  }

  const sound = activeSound;
  activeSound = null;
  activeSourceKey = null;
  activeLooping = true;

  try {
    sound.setOnPlaybackStatusUpdate(null);
    await pauseSound(sound, true);
  } catch {
    // Sound may already be unloaded.
  }

  await releaseBackgroundAudioMode();
}
