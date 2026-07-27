import { Platform } from 'react-native';
import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import {
  speechRecognitionLocale,
  supportsContinuousDictation,
} from './speechRecognitionLocale';

type ResultLike = {
  transcript: string;
  confidence: number;
};

/** Pick the highest-confidence alternative when the engine returns several. */
export function bestRecognitionTranscript(results: readonly ResultLike[]): string {
  if (results.length === 0) return '';
  let best = results[0]!;
  for (let i = 1; i < results.length; i++) {
    const candidate = results[i]!;
    const bestScore = best.confidence >= 0 ? best.confidence : 0;
    const candidateScore = candidate.confidence >= 0 ? candidate.confidence : 0;
    if (candidateScore > bestScore) {
      best = candidate;
    }
  }
  return best.transcript.trim();
}

/**
 * Android 14+ on-device bilingual extras.
 * `quick_response` switches at the earliest confident detection — better for
 * mixed FR/EN in one breath than `balanced` / `high_precision`.
 * Do not set MAX_SWITCHES or INITIAL_ACTIVE_DURATION (those cap mid-note switching).
 */
export function buildBilingualAndroidIntentOptions(
  switchLocales: readonly string[],
): NonNullable<ExpoSpeechRecognitionOptions['androidIntentOptions']> {
  const locales = [...switchLocales];
  return {
    EXTRA_ENABLE_LANGUAGE_DETECTION: true,
    EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: locales,
    // RecognizerIntentEnableLanguageSwitch.LANGUAGE_SWITCH_QUICK_RESPONSE
    EXTRA_ENABLE_LANGUAGE_SWITCH: 'quick_response',
    EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: locales,
  };
}

/** Shared Android intent extras for note dictation (API 33+ where applicable). */
export function buildAndroidDictationIntentOptions(
  switchLocales?: readonly string[],
): NonNullable<ExpoSpeechRecognitionOptions['androidIntentOptions']> {
  return {
    // Default is true — masks swear words as s**t / ****. Notes are personal; keep verbatim.
    EXTRA_MASK_OFFENSIVE_WORDS: false,
    ...(switchLocales != null && switchLocales.length >= 2
      ? buildBilingualAndroidIntentOptions(switchLocales)
      : {}),
  };
}

/**
 * Recognition options for journal/note dictation.
 * Always on-device (`requiresOnDeviceRecognition: true`).
 * When `switchLocales` has EN+FR packs, enable Android 14+ language switch.
 */
export function buildLocalNoteDictationOptions(
  locale = speechRecognitionLocale(),
  androidPackage?: string,
  switchLocales?: readonly string[],
): ExpoSpeechRecognitionOptions {
  return {
    lang: locale,
    /** Live Echo — partial hypotheses while listening (wet ink in the note sheet). */
    interimResults: true,
    continuous: supportsContinuousDictation(),
    addsPunctuation: true,
    maxAlternatives: 5,
    requiresOnDeviceRecognition: true,
    iosTaskHint: 'dictation',
    ...(Platform.OS === 'android'
      ? {
          ...(androidPackage
            ? { androidRecognitionServicePackage: androidPackage }
            : {}),
          androidIntentOptions: buildAndroidDictationIntentOptions(switchLocales),
        }
      : {}),
  };
}
