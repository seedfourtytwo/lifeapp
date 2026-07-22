import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getSpeechLocaleCandidates } from '../i18n';
import {
  androidPackageUsesAsiOfflineApis,
  pickAndroidRecognitionPackage,
} from './speechRecognitionAndroid';
import { SPEECH_MSG } from './speechRecognitionErrors';
import {
  normalizeSpeechLocaleTag,
  pickInstalledSpeechLocale,
} from './speechRecognitionLocale';

export type LocalDictationPrep =
  | {
      ready: true;
      locale: string;
      androidPackage?: string;
      requiresOnDeviceRecognition: boolean;
    }
  | { ready: false; message: string };

function listAndroidRecognitionServices(): string[] {
  try {
    return ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
  } catch {
    return [];
  }
}

/** Successful package only — never permanently cache “none found”. */
let cachedAndroidPackage: string | undefined;

function resolveAndroidRecognitionPackage(): string | undefined {
  if (cachedAndroidPackage) return cachedAndroidPackage;
  const picked = pickAndroidRecognitionPackage(listAndroidRecognitionServices());
  if (picked) cachedAndroidPackage = picked;
  return picked;
}

/** Drop memoized package so the next attempt can see a newly installed engine. */
export function clearAndroidRecognitionPackageCache(): void {
  cachedAndroidPackage = undefined;
}

/** Google TTS / sandboxed Play — voice packs live in that app’s settings. */
function prepGoogleTtsDictation(
  locale: string,
  androidPackage: string,
): LocalDictationPrep {
  return {
    ready: true,
    locale,
    androidPackage,
    // ASI offline-download APIs do not apply; may use local packs or network.
    requiresOnDeviceRecognition: false,
  };
}

async function prepAsiOfflineDictation(
  candidates: readonly string[],
  androidPackage: string,
): Promise<LocalDictationPrep> {
  const downloadLocale = normalizeSpeechLocaleTag(candidates[0] ?? 'en-US');

  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: androidPackage,
    });

    const installed = pickInstalledSpeechLocale(candidates, installedLocales);
    if (installed) {
      return {
        ready: true,
        locale: installed,
        androidPackage,
        requiresOnDeviceRecognition: true,
      };
    }

    const download = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: downloadLocale,
    });

    if (download.status === 'download_success') {
      return {
        ready: true,
        locale: downloadLocale,
        androidPackage,
        requiresOnDeviceRecognition: true,
      };
    }

    if (download.status === 'opened_dialog') {
      return { ready: false, message: SPEECH_MSG.offlineModel };
    }

    return { ready: false, message: SPEECH_MSG.offlineCanceled };
  } catch {
    // ASI prep can throw on non-stock ROMs — still attempt on-device start.
    return {
      ready: true,
      locale: downloadLocale,
      androidPackage,
      requiresOnDeviceRecognition: true,
    };
  }
}

async function prepareAndroidDictation(
  candidates: readonly string[],
  androidPackage: string,
): Promise<LocalDictationPrep> {
  const preferred = normalizeSpeechLocaleTag(candidates[0] ?? 'en-US');
  if (!androidPackageUsesAsiOfflineApis(androidPackage)) {
    return prepGoogleTtsDictation(preferred, androidPackage);
  }
  return prepAsiOfflineDictation(candidates, androidPackage);
}

/**
 * Prepare the best available speech backend for note dictation.
 * Prefers Android System Intelligence; falls back to Google TTS (GrapheneOS).
 */
export async function ensureLocalDictationReady(
  locale?: string,
): Promise<LocalDictationPrep> {
  const candidates = locale
    ? [normalizeSpeechLocaleTag(locale), ...getSpeechLocaleCandidates()]
    : getSpeechLocaleCandidates();
  const uniqueCandidates = [...new Set(candidates.map((tag) => normalizeSpeechLocaleTag(tag)))];

  if (Platform.OS === 'ios') {
    if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      return { ready: false, message: SPEECH_MSG.iosOnDevice };
    }
    return {
      ready: true,
      locale: uniqueCandidates[0] ?? 'en-US',
      requiresOnDeviceRecognition: true,
    };
  }

  if (Platform.OS !== 'android') {
    return { ready: false, message: SPEECH_MSG.webOnly };
  }

  const androidPackage = resolveAndroidRecognitionPackage();
  if (androidPackage) {
    return prepareAndroidDictation(uniqueCandidates, androidPackage);
  }

  return { ready: false, message: SPEECH_MSG.installTts };
}
