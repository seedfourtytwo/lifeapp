/**
 * User-facing dictation copy. Local Moonshine engine — never suggest cloud STT.
 */
import { i18n } from '../i18n';

const DICTATION_MSG_KEYS = [
  'webOnly',
  'notAvailable',
  'micLifeApp',
  'checkingModel',
  'finishingTranscription',
  'downloadFailed',
  'timedOut',
  'unavailable',
  'busy',
  'generic',
  'network',
] as const;

type DictationMsgKey = (typeof DICTATION_MSG_KEYS)[number];

/**
 * Resolves to the current language on each access.
 */
export const DICTATION_MSG = {
  downloadProgress(locale: string, progress: number): string {
    return i18n.t('common:dictation.downloadProgress', { locale, progress });
  },
  downloadFailedDetail(detail: string): string {
    return i18n.t('common:dictation.downloadFailedDetail', { detail });
  },
} as Record<DictationMsgKey, string> & {
  downloadProgress(locale: string, progress: number): string;
  downloadFailedDetail(detail: string): string;
};

for (const key of DICTATION_MSG_KEYS) {
  Object.defineProperty(DICTATION_MSG, key, {
    enumerable: true,
    get() {
      return i18n.t(`common:dictation.${key}`);
    },
  });
}

/**
 * Map a native / download error into a short “what to do” message.
 * Returns null for benign codes the UI should ignore (aborted / no-speech).
 */
export function messageForDictationError(
  error: string,
  rawMessage?: string | null,
): string | null {
  switch (error) {
    case 'aborted':
    case 'no-speech':
      return null;
    case 'not-allowed':
      return DICTATION_MSG.micLifeApp;
    case 'busy':
      return DICTATION_MSG.busy;
    case 'network':
      return DICTATION_MSG.network;
    default:
      break;
  }

  const raw = (rawMessage || '').toLowerCase();
  if (raw.includes('already active')) {
    return DICTATION_MSG.busy;
  }
  if (raw.includes('insufficient') || raw.includes('permission')) {
    return DICTATION_MSG.micLifeApp;
  }
  if (
    raw.includes('network') ||
    raw.includes('unable to resolve') ||
    raw.includes('failed to connect') ||
    raw.includes('econnrefused') ||
    raw.includes('enotfound')
  ) {
    return DICTATION_MSG.network;
  }
  return DICTATION_MSG.generic;
}
