/**
 * Locale helpers for dictation polish / future multi-model selection.
 * Recognition v1 is English-only (Moonshine Small Streaming); keep tags normalized.
 */
import {
  getSpeechLocaleCandidates,
  getSpeechLocaleCandidatesForLanguage,
} from '../i18n';

/** Normalize a raw locale tag (BCP-47-ish). */
export function normalizeSpeechLocaleTag(raw: string, fallback = 'en-US'): string {
  const locale = raw.trim().replace('_', '-');
  if (locale.length < 2) return fallback;

  if (/^[a-z]{2}$/i.test(locale)) {
    if (locale.toLowerCase() === 'en') return 'en-US';
    if (locale.toLowerCase() === 'fr') return 'fr-FR';
    return `${locale}-${locale.toUpperCase()}`;
  }

  const parts = locale.split('-');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}${
      parts.length > 2 ? `-${parts.slice(2).join('-')}` : ''
    }`;
  }
  return locale;
}

/**
 * BCP-47 tag from app language (device region when it matches).
 * Used for transcript polish; STT model locale is pinned separately for v1.
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

/** Preferred candidates for a language code (e.g. future FR model pack). */
export function speechLocaleCandidatesForLanguage(
  language: 'en' | 'fr',
): string[] {
  return getSpeechLocaleCandidatesForLanguage(language).map((tag) =>
    normalizeSpeechLocaleTag(tag),
  );
}
