/**
 * Preferred Android speech backends for note dictation.
 * ASI first (true on-device); Google TTS for GrapheneOS / sandboxed Play.
 */
export const ANDROID_ASI_PACKAGE = 'com.google.android.as';
export const ANDROID_GOOGLE_TTS_PACKAGE = 'com.google.android.tts';

export const ANDROID_RECOGNITION_PACKAGES = [
  ANDROID_ASI_PACKAGE,
  ANDROID_GOOGLE_TTS_PACKAGE,
] as const;

/** First matching installed package, or undefined. */
export function pickAndroidRecognitionPackage(
  services: readonly string[],
): string | undefined {
  for (const pkg of ANDROID_RECOGNITION_PACKAGES) {
    if (services.includes(pkg)) return pkg;
  }
  return undefined;
}

/** ASI uses OS offline-model download APIs; Google TTS does not. */
export function androidPackageUsesAsiOfflineApis(packageName: string): boolean {
  return packageName === ANDROID_ASI_PACKAGE;
}
