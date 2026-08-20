import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCalendar from './locales/en/calendar.json';
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enInsights from './locales/en/insights.json';
import enJournal from './locales/en/journal.json';
import enNotifications from './locales/en/notifications.json';
import enNutrition from './locales/en/nutrition.json';
import enSettings from './locales/en/settings.json';
import enTrackers from './locales/en/trackers.json';

import frCalendar from './locales/fr/calendar.json';
import frCommon from './locales/fr/common.json';
import frHome from './locales/fr/home.json';
import frInsights from './locales/fr/insights.json';
import frJournal from './locales/fr/journal.json';
import frNotifications from './locales/fr/notifications.json';
import frNutrition from './locales/fr/nutrition.json';
import frSettings from './locales/fr/settings.json';
import frTrackers from './locales/fr/trackers.json';

import { RESOLVED_LANGUAGES, type AppLanguage, type ResolvedLanguage } from './types';

export const defaultNS = 'common' as const;

export const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
    home: enHome,
    trackers: enTrackers,
    calendar: enCalendar,
    journal: enJournal,
    insights: enInsights,
    notifications: enNotifications,
    nutrition: enNutrition,
  },
  fr: {
    common: frCommon,
    settings: frSettings,
    home: frHome,
    trackers: frTrackers,
    calendar: frCalendar,
    journal: frJournal,
    insights: frInsights,
    notifications: frNotifications,
    nutrition: frNutrition,
  },
} as const;

function isResolvedLanguage(value: string | null | undefined): value is ResolvedLanguage {
  return value != null && (RESOLVED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Device language codes without a native module.
 * Uses Intl so System language works on older dev clients that lack ExpoLocalization.
 */
export function deviceLanguageCodes(): string[] {
  const codes: string[] = [];
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    const primary = tag.split(/[-_]/)[0]?.toLowerCase();
    if (primary) codes.push(primary);
  } catch {
    // Intl unavailable in rare environments
  }
  return codes;
}

/** Resolve a user language preference to a concrete, supported language. */
export function resolveLanguage(preference: AppLanguage): ResolvedLanguage {
  if (preference !== 'system') {
    return preference;
  }
  for (const code of deviceLanguageCodes()) {
    if (isResolvedLanguage(code)) {
      return code;
    }
  }
  return 'en';
}

void i18next.use(initReactI18next).init({
  resources,
  lng: resolveLanguage('system'),
  fallbackLng: 'en',
  defaultNS,
  ns: Object.keys(resources.en),
  compatibilityJSON: 'v4',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

/** Apply a language preference — resolves "system" and switches i18next. */
export async function applyAppLanguage(preference: AppLanguage): Promise<ResolvedLanguage> {
  const resolved = resolveLanguage(preference);
  await i18next.changeLanguage(resolved);
  return resolved;
}

/** BCP-47 locale for date/number formatting, matching the active app language. */
export function getDateLocale(): string {
  return i18next.resolvedLanguage === 'fr' ? 'fr-FR' : 'en-US';
}

const SPEECH_LOCALE_DEFAULTS: Record<'en' | 'fr', readonly string[]> = {
  en: ['en-US', 'en-GB', 'en-AU', 'en-IE'],
  fr: ['fr-FR', 'fr-CA', 'fr-BE', 'fr-CH'],
};

/**
 * Preferred speech-recognition locale tags for a language.
 * Puts the device region first when it matches (en-GB phone + English → en-GB).
 */
export function getSpeechLocaleCandidatesForLanguage(
  language: 'en' | 'fr',
): string[] {
  const defaults = SPEECH_LOCALE_DEFAULTS[language];
  const candidates: string[] = [];

  try {
    const device = Intl.DateTimeFormat().resolvedOptions().locale;
    const primary = device.split(/[-_]/)[0]?.toLowerCase();
    if (primary === language) {
      candidates.push(device.replace('_', '-'));
    }
  } catch {
    // Intl unavailable
  }

  for (const tag of defaults) {
    if (!candidates.some((c) => c.toLowerCase() === tag.toLowerCase())) {
      candidates.push(tag);
    }
  }
  return candidates;
}

/**
 * Preferred speech-recognition locale tags for the active app language.
 */
export function getSpeechLocaleCandidates(): string[] {
  const language = i18next.resolvedLanguage === 'fr' ? 'fr' : 'en';
  return getSpeechLocaleCandidatesForLanguage(language);
}

/** Best-effort BCP-47 tag for speech recognition (first preferred candidate). */
export function getSpeechLocale(): string {
  return getSpeechLocaleCandidates()[0] ?? 'en-US';
}

export const i18n = i18next;
export default i18next;
