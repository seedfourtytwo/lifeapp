/**
 * On-device Android speech — Android System Intelligence + offline voice packs.
 * Does not use Google Play Speech Recognition & synthesis or network engines.
 */
export const ANDROID_ASI_PACKAGE = 'com.google.android.as';

/** Only engine Life Dashboard will use for Android dictation. */
export const ANDROID_RECOGNITION_PACKAGES = [ANDROID_ASI_PACKAGE] as const;

/** First matching installed package, or undefined. */
export function pickAndroidRecognitionPackage(
  services: readonly string[],
): string | undefined {
  for (const pkg of ANDROID_RECOGNITION_PACKAGES) {
    if (services.includes(pkg)) return pkg;
  }
  return undefined;
}

export function isAndroidOnDeviceSpeechPackage(packageName: string): boolean {
  return packageName === ANDROID_ASI_PACKAGE;
}
