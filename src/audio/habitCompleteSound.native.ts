import { HABIT_COMPLETE_CHIME } from './habitCompleteSoundAssets.native';

type ExpoAudioModule = typeof import('expo-audio');
type AudioPlayer = import('expo-audio').AudioPlayer;

let chimePlayer: AudioPlayer | null = null;
let chimeLoading: Promise<AudioPlayer | null> | null = null;
let audioModule: ExpoAudioModule | null = null;

async function getAudio(): Promise<ExpoAudioModule | null> {
  if (audioModule) return audioModule;
  try {
    audioModule = await import('expo-audio');
    return audioModule;
  } catch {
    return null;
  }
}

async function loadChime(): Promise<AudioPlayer | null> {
  if (chimePlayer) return chimePlayer;
  if (chimeLoading) return chimeLoading;

  chimeLoading = (async () => {
    const Audio = await getAudio();
    if (!Audio) return null;
    await Audio.setAudioModeAsync({ playsInSilentMode: true });
    const player = Audio.createAudioPlayer(HABIT_COMPLETE_CHIME);
    player.volume = 0.55;
    chimePlayer = player;
    return player;
  })();

  try {
    return await chimeLoading;
  } finally {
    chimeLoading = null;
  }
}

/** Soft meditation-bowl chime when a habit reaches its goal or finishes a track. */
export async function playHabitCompleteChime(): Promise<void> {
  try {
    const player = await loadChime();
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch {
    // Non-critical feedback — ignore playback errors.
  }
}

export async function warmupHabitCompleteChime(): Promise<void> {
  await loadChime();
}
