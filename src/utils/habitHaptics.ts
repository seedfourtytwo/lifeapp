import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type HapticsModule = typeof import('expo-haptics');

let hapticsModule: HapticsModule | null = null;
let hapticsUnavailable = false;

function isHapticsNativeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return requireOptionalNativeModule('ExpoHaptics') != null;
}

async function getHaptics(): Promise<HapticsModule | null> {
  if (hapticsUnavailable || !isHapticsNativeAvailable()) {
    hapticsUnavailable = true;
    return null;
  }
  if (hapticsModule) return hapticsModule;
  try {
    hapticsModule = await import('expo-haptics');
    return hapticsModule;
  } catch {
    hapticsUnavailable = true;
    return null;
  }
}

/** Light tap when a habit becomes complete. No-op on web / missing native module. */
export async function playHabitCompleteHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (!Haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore — haptics must never break habit logging
  }
}

/** Soft selection feedback for chart day taps. */
export async function playChartSelectHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (!Haptics) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore
  }
}
