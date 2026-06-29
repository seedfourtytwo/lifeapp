type AvSound = import('expo-av').Audio.Sound;
type AvAudio = typeof import('expo-av').Audio;

let activeSound: AvSound | null = null;
let activeUri: string | null = null;
let audioModule: AvAudio | null = null;
let audioUnavailable = false;

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
    console.warn('expo-av is unavailable; timer sounds disabled until you rebuild the dev client.', error);
    return null;
  }
}

export async function playLoopingHabitSound(uri: string): Promise<void> {
  const Audio = await getAudio();
  if (!Audio) return;

  if (activeUri === uri && activeSound) {
    return;
  }

  await stopLoopingHabitSound();

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { isLooping: true, shouldPlay: true, volume: 1 },
  );

  activeSound = sound;
  activeUri = uri;
}

export async function stopLoopingHabitSound(): Promise<void> {
  if (!activeSound) {
    activeUri = null;
    return;
  }

  try {
    await activeSound.stopAsync();
    await activeSound.unloadAsync();
  } finally {
    activeSound = null;
    activeUri = null;
  }
}

/** Test-only reset. */
export function resetHabitSoundPlaybackForTests(): void {
  activeSound = null;
  activeUri = null;
  audioModule = null;
  audioUnavailable = false;
}
