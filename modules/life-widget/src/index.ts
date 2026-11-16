import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type LifeWidgetNativeModule = {
  requestUpdate(): void;
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
