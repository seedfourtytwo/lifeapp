import type { HabitTimerSound } from '../protocol/habitSound';
import { getHabitTimerPlaybackMode } from '../protocol/habitSound';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getBundledHabitSoundModule,
  TIMER_KEEPALIVE_SOUND_MODULE,
} from './bundledHabitSoundAssets';
import {
  resolveHabitTimerPlaybackSource,
  type HabitTimerPlaybackSource,
} from './habitTimerPlayback';
import { detectLockScreenSeekSkip, isLockScreenLoopWrap } from './lockScreenSeekDetect';

type ExpoAudioModule = typeof import('expo-audio');
type AudioPlayer = import('expo-audio').AudioPlayer;
type AudioMetadata = import('expo-audio').AudioMetadata;
type AudioStatus = import('expo-audio').AudioStatus;

export type HabitTimerLockScreenMeta = AudioMetadata;

export type HabitSoundPlaybackOptions = {
  onEnded?: () => void;
  /** Shown on the OS lock-screen / media notification while the timer runs. */
  lockScreen?: HabitTimerLockScreenMeta;
};

const KEEPALIVE_SOURCE = TIMER_KEEPALIVE_SOUND_MODULE;

let audioModule: ExpoAudioModule | null = null;
let audioUnavailable = false;
let player: AudioPlayer | null = null;
let statusSub: { remove: () => void } | null = null;
let activeSourceKey: string | null = null;
let userPausedPlayback = false;
let playbackEpoch = 0;
/** When true, status updates are from our own pause/play — ignore for remote sync. */
let ignoreRemoteStatus = false;
let onRemotePlayingChange: ((playing: boolean) => void) | null = null;
let onRemoteSkip: ((direction: 'next' | 'prev') => void) | null = null;
let onTrackEnded: (() => void) | null = null;
const preloadedSourceKeys = new Set<string>();
/** Seek-detection baseline — reset after local seeks/replaces to avoid false skips. */
let seekBaselineTime = 0;
let seekBaselineAtMs = Date.now();
/** Last playing flag reported to remote handlers — edge-trigger only. */
let lastReportedPlaying: boolean | null = null;

function resetSeekBaseline(currentTime = 0): void {
  seekBaselineTime = currentTime;
  seekBaselineAtMs = Date.now();
}

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function ensureAppStateResumeListener(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void resumeActiveSoundIfInterrupted();
    }
  });
}

async function resumeActiveSoundIfInterrupted(): Promise<void> {
  if (!player || userPausedPlayback) return;
  try {
    if (!player.playing) {
      player.play();
    }
  } catch {
    // Playback may have been torn down by the OS.
  }
}

function sourceKey(source: HabitTimerPlaybackSource): string {
  return `bundled:${source.moduleId}`;
}

function isPlaybackStale(epoch: number): boolean {
  return epoch !== playbackEpoch;
}

async function getAudio(): Promise<ExpoAudioModule | null> {
  if (audioUnavailable) return null;
  if (audioModule) return audioModule;
  try {
    audioModule = await import('expo-audio');
    return audioModule;
  } catch (error) {
    audioUnavailable = true;
    console.warn(
      'expo-audio is unavailable; timer sounds and lock-screen controls disabled until you rebuild the dev client.',
      error,
    );
    return null;
  }
}

async function ensureAudioMode(
  Audio: ExpoAudioModule,
  forBackgroundPlayback: boolean,
): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: forBackgroundPlayback,
    interruptionMode: forBackgroundPlayback ? 'doNotMix' : 'mixWithOthers',
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
  });
}

function detachStatusListener(): void {
  statusSub?.remove();
  statusSub = null;
}

function attachStatusListener(activePlayer: AudioPlayer): void {
  detachStatusListener();
  statusSub = activePlayer.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    if (ignoreRemoteStatus) return;

    if (status.didJustFinish && !status.loop) {
      if (userPausedPlayback) {
        onTrackEnded = null;
        return;
      }
      const ended = onTrackEnded;
      onTrackEnded = null;
      ended?.();
      return;
    }

    if (!status.isLoaded) return;

    const nowMs = Date.now();
    const wallDeltaMs = nowMs - seekBaselineAtMs;

    if (
      isLockScreenLoopWrap({
        currentTime: status.currentTime,
        lastCurrentTime: seekBaselineTime,
        duration: status.duration,
        loop: status.loop,
      })
    ) {
      resetSeekBaseline(status.currentTime);
      if (lastReportedPlaying !== status.playing) {
        lastReportedPlaying = status.playing;
        onRemotePlayingChange?.(status.playing);
      }
      return;
    }

    const skip = detectLockScreenSeekSkip({
      currentTime: status.currentTime,
      lastCurrentTime: seekBaselineTime,
      duration: status.duration,
      loop: status.loop,
      wallDeltaMs,
    });
    if (skip) {
      const restoreTo = Math.max(0, seekBaselineTime);
      void withLocalControl(async () => {
        try {
          await activePlayer.seekTo(restoreTo);
          resetSeekBaseline(restoreTo);
        } catch {
          // Player may have been replaced.
        }
      });
      onRemoteSkip?.(skip);
      return;
    }

    resetSeekBaseline(status.currentTime);
    if (lastReportedPlaying !== status.playing) {
      lastReportedPlaying = status.playing;
      onRemotePlayingChange?.(status.playing);
    }
  });
}

async function ensurePlayer(Audio: ExpoAudioModule): Promise<AudioPlayer> {
  if (player) return player;
  player = Audio.createAudioPlayer(KEEPALIVE_SOURCE, { updateInterval: 1000 });
  attachStatusListener(player);
  return player;
}

async function withLocalControl(work: () => void | Promise<void>): Promise<void> {
  ignoreRemoteStatus = true;
  try {
    await work();
  } finally {
    // Resync baseline + playing edge so the next remote status can fire correctly
    // after local play/pause/replace (e.g. Ready state ends paused).
    try {
      const playing = player?.playing ?? false;
      lastReportedPlaying = playing;
      resetSeekBaseline(player?.currentTime ?? 0);
    } catch {
      lastReportedPlaying = false;
      resetSeekBaseline(0);
    }
    setTimeout(() => {
      ignoreRemoteStatus = false;
      try {
        lastReportedPlaying = player?.playing ?? lastReportedPlaying;
        resetSeekBaseline(player?.currentTime ?? seekBaselineTime);
      } catch {
        // Player may already be released.
      }
    }, 250);
  }
}

/**
 * Register callbacks for lock-screen / headset transport.
 * `onPlayingChange` fires when the OS pauses or resumes playback (not when we do).
 * `onSkip` fires when seek ±10s buttons are used (mapped to next/prev habit).
 */
export function setHabitTimerRemoteHandlers(handlers: {
  onPlayingChange?: ((playing: boolean) => void) | null;
  onSkip?: ((direction: 'next' | 'prev') => void) | null;
}): void {
  onRemotePlayingChange = handlers.onPlayingChange ?? null;
  onRemoteSkip = handlers.onSkip ?? null;
}

export function updateHabitTimerLockScreen(metadata: HabitTimerLockScreenMeta): void {
  if (!player) return;
  try {
    player.updateLockScreenMetadata(metadata);
  } catch {
    // Lock screen may already be cleared.
  }
}

export function clearHabitTimerLockScreen(): void {
  if (!player) return;
  try {
    player.clearLockScreenControls();
  } catch {
    // Already cleared.
  }
}

function activateLockScreen(metadata?: HabitTimerLockScreenMeta): void {
  if (!player || !metadata) return;
  try {
    player.setActiveForLockScreen(true, metadata, {
      // Repurposed as next / previous habit (see seek detection in status listener).
      showSeekForward: true,
      showSeekBackward: true,
    });
  } catch (error) {
    console.warn('Failed to activate lock screen controls', error);
  }
}

function hasResolvableSound(sound: HabitTimerSound): boolean {
  const trackId = sound.trackId?.trim();
  if (!trackId) return false;
  return getBundledHabitSoundModule(trackId) !== undefined;
}

async function playSource(
  moduleId: number,
  key: string,
  loop: boolean,
  onEnded: (() => void) | undefined,
  requestEpoch: number,
  lockScreen?: HabitTimerLockScreenMeta,
  muted = false,
): Promise<boolean> {
  if (isPlaybackStale(requestEpoch)) return false;

  const Audio = await getAudio();
  if (!Audio || isPlaybackStale(requestEpoch)) return false;

  await ensureAudioMode(Audio, true);
  ensureAppStateResumeListener();
  const activePlayer = await ensurePlayer(Audio);
  if (isPlaybackStale(requestEpoch)) return false;

  onTrackEnded = loop ? null : onEnded ?? null;

  await withLocalControl(async () => {
    if (activeSourceKey !== key) {
      activePlayer.replace(moduleId);
      activeSourceKey = key;
    }
    preloadedSourceKeys.add(key);
    activePlayer.loop = loop;
    activePlayer.muted = muted;
    await activePlayer.seekTo(0);
    resetSeekBaseline(0);
    if (isPlaybackStale(requestEpoch)) return;
    activePlayer.play();
    activateLockScreen(lockScreen);
  });

  return !isPlaybackStale(requestEpoch);
}

export async function warmupHabitSoundPlayback(): Promise<void> {
  const Audio = await getAudio();
  if (!Audio) return;
  await ensureAudioMode(Audio, false);
}

export async function preloadHabitSound(sound?: HabitTimerSound): Promise<boolean> {
  if (!sound || !hasResolvableSound(sound)) return false;
  const source = await resolveHabitTimerPlaybackSource(sound);
  if (!source) return false;

  const key = sourceKey(source);
  if (preloadedSourceKeys.has(key)) return true;

  const Audio = await getAudio();
  if (!Audio) return false;

  try {
    const warmPlayer = Audio.createAudioPlayer(source.moduleId, { updateInterval: 1000 });
    // Give the native player a moment to start decoding, then release.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    warmPlayer.remove();
    preloadedSourceKeys.add(key);
    return true;
  } catch (error) {
    console.warn('Failed to preload habit timer sound', error);
    return false;
  }
}

export function isHabitSoundCached(sound?: HabitTimerSound): boolean {
  if (!sound || !hasResolvableSound(sound)) return false;
  const trackId = sound.trackId?.trim();
  if (!trackId) return false;
  const moduleId = getBundledHabitSoundModule(trackId);
  if (moduleId === undefined) return false;
  return preloadedSourceKeys.has(`bundled:${moduleId}`);
}

/**
 * Start (or keep) timer audio. When no habit sound is configured, plays a muted
 * keepalive loop so Android/iOS still expose lock-screen media controls.
 */
export async function playHabitSound(
  sound?: HabitTimerSound,
  options?: HabitSoundPlaybackOptions,
): Promise<boolean> {
  const requestEpoch = ++playbackEpoch;
  userPausedPlayback = false;

  if (sound && hasResolvableSound(sound)) {
    const source = await resolveHabitTimerPlaybackSource(sound);
    if (!source || isPlaybackStale(requestEpoch)) return false;
    const loop = getHabitTimerPlaybackMode(sound) === 'loop';
    return playSource(
      source.moduleId,
      sourceKey(source),
      loop,
      options?.onEnded,
      requestEpoch,
      options?.lockScreen,
      false,
    );
  }

  return playSource(
    KEEPALIVE_SOURCE,
    'keepalive',
    true,
    undefined,
    requestEpoch,
    options?.lockScreen,
    true,
  );
}

export async function pauseHabitSound(): Promise<void> {
  userPausedPlayback = true;
  // Pause must not look like a natural play-once finish (that would chime + Done).
  onTrackEnded = null;
  if (!player) return;
  await withLocalControl(() => {
    player?.pause();
  });
}

export async function resumeHabitSound(
  sound?: HabitTimerSound,
  options?: HabitSoundPlaybackOptions,
): Promise<boolean> {
  userPausedPlayback = false;

  if (player && activeSourceKey) {
    const wantKeepalive = !sound || !hasResolvableSound(sound);
    const isKeepalive = activeSourceKey === 'keepalive';
    const sameKind =
      wantKeepalive === isKeepalive ||
      (!wantKeepalive && activeSourceKey.startsWith('bundled:'));

    if (sameKind) {
      await withLocalControl(() => {
        if (!player) return;
        if (options?.lockScreen) {
          activateLockScreen(options.lockScreen);
        }
        if (wantKeepalive) {
          player.muted = true;
          player.loop = true;
          onTrackEnded = null;
        } else if (sound) {
          const loop = getHabitTimerPlaybackMode(sound) === 'loop';
          player.loop = loop;
          onTrackEnded = loop ? null : options?.onEnded ?? null;
          player.muted = false;
        }
        player.play();
      });
      return true;
    }
  }

  return playHabitSound(sound, options);
}

export async function stopHabitSound(): Promise<void> {
  playbackEpoch += 1;
  userPausedPlayback = false;
  onTrackEnded = null;

  if (!player) {
    activeSourceKey = null;
    return;
  }

  await withLocalControl(() => {
    try {
      player?.pause();
      player?.clearLockScreenControls();
    } catch {
      // Player may already be released.
    }
  });

  activeSourceKey = null;

  const Audio = await getAudio();
  if (!Audio) return;
  try {
    await ensureAudioMode(Audio, false);
  } catch {
    // Mode reset is best-effort.
  }
}

export function isHabitTimerSoundUserPaused(): boolean {
  return userPausedPlayback;
}
