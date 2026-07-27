import { Platform } from 'react-native';
import {
  getSpeechLocaleCandidates,
  getSpeechLocaleCandidatesForLanguage,
} from '../i18n';

/** Normalize a raw locale tag for on-device speech recognition. */
export function normalizeSpeechLocaleTag(raw: string, fallback = 'en-US'): string {
  const locale = raw.trim().replace('_', '-');
  if (locale.length < 2) return fallback;

  // Bare language tags (e.g. "en") are flaky on some Android recognizers.
  if (/^[a-z]{2}$/i.test(locale)) {
    if (locale.toLowerCase() === 'en') return 'en-US';
    if (locale.toLowerCase() === 'fr') return 'fr-FR';
    return `${locale}-${locale.toUpperCase()}`;
  }

  // ASI languagedetection often returns lowercase ("en-us").
  const parts = locale.split('-');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}${parts.length > 2 ? `-${parts.slice(2).join('-')}` : ''}`;
  }
  return locale;
}

export function languageCode(tag: string): string {
  return normalizeSpeechLocaleTag(tag).split('-')[0]?.toLowerCase() ?? '';
}

/**
 * BCP-47 tag for speech recognition.
 * Follows the app language, preferring the device region when it matches
 * (e.g. English UI on an en-GB phone → en-GB, not en-US).
 */
export function speechRecognitionLocale(fallback = 'en-US'): string {
  try {
    const [preferred] = getSpeechLocaleCandidates();
    if (preferred) return normalizeSpeechLocaleTag(preferred, fallback);
  } catch {
    // i18n unavailable in rare environments
  }
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
  return pickInstalledSpeechLocale(locale, installedLocales) != null;
}

/**
 * Pick an installed locale for recognition.
 * Prefer an exact match from the candidate list; otherwise any pack for the same language
 * (so en-US request can use installed en-GB).
 */
export function pickInstalledSpeechLocale(
  preferredOrCandidates: string | readonly string[],
  installedLocales: readonly string[],
): string | null {
  if (installedLocales.length === 0) return null;

  const candidates = (
    typeof preferredOrCandidates === 'string'
      ? [preferredOrCandidates]
      : [...preferredOrCandidates]
  ).map((tag) => normalizeSpeechLocaleTag(tag));

  const normalizedInstalled = installedLocales.map((tag) => ({
    raw: tag,
    norm: normalizeSpeechLocaleTag(tag),
  }));

  for (const candidate of candidates) {
    const exact = normalizedInstalled.find(
      (entry) =>
        entry.norm.toLowerCase() === candidate.toLowerCase() ||
        entry.raw.toLowerCase() === candidate.toLowerCase(),
    );
    if (exact) return exact.norm;
  }

  const language = languageCode(candidates[0] ?? '');
  if (!language) return null;

  const sameLanguage = normalizedInstalled.find(
    (entry) =>
      entry.norm.toLowerCase() === language ||
      entry.norm.toLowerCase().startsWith(`${language}-`),
  );
  return sameLanguage?.norm ?? null;
}

/**
 * EN+FR locales for mid-session switch, ordered with the primary language first.
 * Returns undefined unless both language packs appear installed.
 */
export function resolveBilingualSwitchLocales(
  primaryLocale: string,
  installedLocales: readonly string[],
): string[] | undefined {
  const en = pickInstalledSpeechLocale(
    getSpeechLocaleCandidatesForLanguage('en'),
    installedLocales,
  );
  const fr = pickInstalledSpeechLocale(
    getSpeechLocaleCandidatesForLanguage('fr'),
    installedLocales,
  );
  if (!en || !fr) return undefined;
  return languageCode(primaryLocale) === 'fr' ? [fr, en] : [en, fr];
}

/**
 * Fallback EN+FR pair when locale listing fails but on-device recognition works
 * (some ROMs / package-visibility quirks return an empty installed list).
 */
export function defaultBilingualSwitchLocales(primaryLocale: string): string[] {
  const en = normalizeSpeechLocaleTag(
    getSpeechLocaleCandidatesForLanguage('en')[0] ?? 'en-US',
  );
  const fr = normalizeSpeechLocaleTag(
    getSpeechLocaleCandidatesForLanguage('fr')[0] ?? 'fr-FR',
  );
  return languageCode(primaryLocale) === 'fr' ? [fr, en] : [en, fr];
}

/** Long-form dictation (record until Done) needs continuous recognition (Android 13+). */
export function supportsContinuousDictation(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'ios') return true;
  return Number(Platform.Version) >= 33;
}

/**
 * Mid-session EN↔FR switch (same note) needs Android 14+ on-device language switch.
 * Both offline language packs must also be installed — checked at prep time.
 */
export function supportsBilingualDictationSwitch(): boolean {
  if (Platform.OS !== 'android') return false;
  return Number(Platform.Version) >= 34;
}
