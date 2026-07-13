import { HABIT_COMPLETE_CHIME } from './habitCompleteSoundAssets.native';

type AvSound = import('expo-av').Audio.Sound;
type AvAudio = typeof import('expo-av').Audio;

let chimeSound: AvSound | null = null;
let chimeLoading: Promise<AvSound | null> | null = null;
let audioModule: AvAudio | null = null;

async function getAudio(): Promise<AvAudio | null> {
  if (audioModule) return audioModule;
  try {
    const { Audio } = await import('expo-av');
    audioModule = Audio;
    return audioModule;
  } catch {
    return null;
  }
}

async function loadChime(): Promise<AvSound | null> {
  if (chimeSound) return chimeSound;
  if (chimeLoading) return chimeLoading;

  chimeLoading = (async () => {
    const Audio = await getAudio();
    if (!Audio) return null;
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(HABIT_COMPLETE_CHIME, {
      shouldPlay: false,
      volume: 0.55,
    });
    chimeSound = sound;
    return sound;
  })();

  try {
    return await chimeLoading;
  } finally {
    chimeLoading = null;
  }
}

/** Short bell when a timer habit reaches its goal or finishes a track. */
export async function playHabitCompleteChime(): Promise<void> {
  try {
    const sound = await loadChime();
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Non-critical feedback — ignore playback errors.
  }
}

export async function warmupHabitCompleteChime(): Promise<void> {
  await loadChime();
}
