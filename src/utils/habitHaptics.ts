import { Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type HapticsModule = typeof import('expo-haptics');

let hapticsModule: HapticsModule | null = null;
let hapticsChecked = false;

function isHapticsNativeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return requireOptionalNativeModule('ExpoHaptics') != null;
}

async function getHaptics(): Promise<HapticsModule | null> {
  if (Platform.OS === 'web') return null;
  if (hapticsChecked) return hapticsModule;
  hapticsChecked = true;
  if (!isHapticsNativeAvailable()) {
    hapticsModule = null;
    return null;
  }
  try {
    hapticsModule = await import('expo-haptics');
    return hapticsModule;
  } catch {
    hapticsModule = null;
    return null;
  }
}

function vibrateFallback(pattern: number | number[]): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(pattern);
  } catch {
    // Ignore
  }
}

/** Light tap when a habit becomes complete. No-op on web / missing native module. */
export async function playHabitCompleteHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    } catch {
      // fall through
    }
  }
  vibrateFallback(12);
}

/** Soft selection feedback for chart day taps. */
export async function playChartSelectHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      await Haptics.selectionAsync();
      return;
    } catch {
      // fall through
    }
  }
  vibrateFallback(6);
}

/** Success tick when Done commits a dictated take into the note. */
export async function playDictationCommitHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    } catch {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      } catch {
        // fall through
      }
    }
  }
  vibrateFallback([0, 12, 40, 18]);
}

/** Medium impact when a Home list drag-reorder activates. */
export async function playReorderDragHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    } catch {
      // fall through
    }
  }
  vibrateFallback(14);
}
