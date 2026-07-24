/**
 * User-facing dictation errors — short and actionable.
 * Point at on-device install; do not suggest cloud speech.
 */
import { i18n } from '../i18n';

const SPEECH_MSG_KEYS = [
  'webOnly',
  'moduleMissing',
  'notAvailable',
  'installOnDevice',
  'micLifeApp',
  'micBoth',
  'offlineModel',
  'offlineCanceled',
  'timedOut',
  'unavailable',
  'language',
  'network',
  'busy',
  'generic',
  'iosOnDevice',
] as const;

/**
 * Resolves to the currently translated message on each property access, so
 * callers always see text for the active language without re-importing.
 */
export const SPEECH_MSG = {} as Record<(typeof SPEECH_MSG_KEYS)[number], string>;

for (const key of SPEECH_MSG_KEYS) {
  Object.defineProperty(SPEECH_MSG, key, {
    enumerable: true,
    get() {
      return i18n.t(`common:dictation.${key}`);
    },
  });
}

type SpeechErrorCode = string;

/**
 * Map a native recognition error into a short “what to do” message.
 * Returns null for benign codes the UI should ignore (aborted / no-speech).
 */
export function messageForSpeechRecognitionError(
  error: SpeechErrorCode,
  rawMessage?: string | null,
): string | null {
  switch (error) {
    case 'aborted':
    case 'no-speech':
      return null;
    case 'not-allowed':
      return SPEECH_MSG.micLifeApp;
    case 'service-not-allowed':
      return SPEECH_MSG.notAvailable;
    case 'language-not-supported':
      return SPEECH_MSG.language;
    case 'network':
      return SPEECH_MSG.network;
    case 'busy':
      return SPEECH_MSG.busy;
    default:
      break;
  }

  const raw = (rawMessage || '').toLowerCase();
  if (raw.includes('insufficient') || raw.includes('permission')) {
    return SPEECH_MSG.micBoth;
  }
  return SPEECH_MSG.generic;
}
