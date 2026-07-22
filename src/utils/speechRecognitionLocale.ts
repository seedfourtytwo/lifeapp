import { Platform } from 'react-native';

/** Normalize a raw locale tag for on-device speech recognition. */
export function normalizeSpeechLocaleTag(raw: string, fallback = 'en-US'): string {
  const locale = raw.trim().replace('_', '-');
  if (locale.length < 2) return fallback;

  // Bare language tags (e.g. "en") are flaky on some Android recognizers.
  if (/^[a-z]{2}$/i.test(locale)) {
    if (locale.toLowerCase() === 'en') return 'en-US';
    return `${locale}-${locale.toUpperCase()}`;
  }
  return locale;
}

/** Best-effort BCP-47 tag for on-device speech recognition. */
export function speechRecognitionLocale(fallback = 'en-US'): string {
  try {
    const raw = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof raw === 'string') {
      return normalizeSpeechLocaleTag(raw, fallback);
    }
  } catch {
    // Intl unavailable in rare environments
  }
  return fallback;
}

/** Whether `locale` (or same language) is installed for offline recognition. */
export function localeIsInstalledForOffline(
  locale: string,
  installedLocales: readonly string[],
): boolean {
  const normalized = normalizeSpeechLocaleTag(locale);
  if (installedLocales.includes(normalized) || installedLocales.includes(locale)) {
    return true;
  }
  const language = normalized.split('-')[0]?.toLowerCase();
  if (!language) return false;
  return installedLocales.some((tag) => tag.toLowerCase().startsWith(`${language}-`));
}

/** Long-form dictation (record until Done) needs continuous recognition (Android 13+). */
export function supportsContinuousDictation(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'ios') return true;
  return Number(Platform.Version) >= 33;
}
