import { Audio } from 'expo-av';

let activeSound: Audio.Sound | null = null;
let activeUri: string | null = null;

export async function playLoopingHabitSound(uri: string): Promise<void> {
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
}
