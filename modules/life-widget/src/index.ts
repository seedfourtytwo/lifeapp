import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type LifeWidgetNativeModule = {
  requestUpdate(): void;
  stopTimer(habitId: string): Promise<void>;
};

/**
 * Android only, and optional: a dev client built before this module existed,
 * web and iOS all get `null` and every call below is a no-op.
 */
const NativeModuleImpl: LifeWidgetNativeModule | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<LifeWidgetNativeModule>('LifeWidget')
    : null;

export function isLifeWidgetAvailable(): boolean {
  return NativeModuleImpl != null;
}

/**
 * Ask the home-screen widget to redraw from SQLite. Runs in the app's main
 * process and only sends a broadcast to the widget's own process — it never
 * touches the database. Safe to call when no widget is placed.
 */
export function requestWidgetUpdate(): void {
  if (!NativeModuleImpl) return;
  try {
    NativeModuleImpl.requestUpdate();
  } catch (error) {
    console.warn('Widget update request failed', error);
  }
}

/**
 * Stop the widget's own timer for a habit and log the time it ran, so the app
 * can take that habit over. A timer left behind by a widget the user has since
 * removed is the case this exists for, so it does not check that a widget is
 * placed.
 *
 * The write happens in the widget's process, which owns that table; this
 * resolves once that process has finished, so the caller's next read sees the
 * row gone instead of racing it. On web, on iOS, on a dev client built before
 * this existed, and for a habit with no widget timer, it does nothing and
 * resolves.
 */
export async function stopWidgetTimer(habitId: string): Promise<void> {
  if (!NativeModuleImpl?.stopTimer) return;
  await NativeModuleImpl.stopTimer(habitId);
}
