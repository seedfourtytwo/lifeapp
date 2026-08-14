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

/** Tiny tick when the weather bubble glances off a wall. */
export async function playBubbleBounceHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      // Softest available tick — selection can feel sharp on some devices.
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      return;
    } catch {
      try {
        await Haptics.selectionAsync();
        return;
      } catch {
        // fall through
      }
    }
  }
  vibrateFallback(3);
}

/** Short celebration when the bubble nails a DVD corner. */
export async function playBubbleCornerHaptic(): Promise<void> {
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    } catch {
      // fall through
    }
  }
  vibrateFallback([0, 16, 35, 22]);
}

/** Release feedback — stronger when more charge was held. */
export async function playBubbleThrowHaptic(charge: number): Promise<void> {
  const c = Math.max(0, Math.min(1, charge));
  const Haptics = await getHaptics();
  if (Haptics) {
    try {
      const style =
        c >= 0.75
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
      await Haptics.impactAsync(style);
      return;
    } catch {
      // fall through
    }
  }
  vibrateFallback(c >= 0.75 ? 18 : 10);
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
