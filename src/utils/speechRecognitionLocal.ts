import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getSpeechLocaleCandidates } from '../i18n';
import { pickAndroidRecognitionPackage } from './speechRecognitionAndroid';
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
      /** Always true — Life Dashboard never sends audio off-device. */
      requiresOnDeviceRecognition: true;
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

function readyOnDevice(
  locale: string,
  androidPackage: string,
): LocalDictationPrep {
  return {
    ready: true,
    locale,
    androidPackage,
    requiresOnDeviceRecognition: true,
  };
}

/**
 * Prepare ASI offline recognition. Missing pack → install/download guidance.
 * Never falls back to a network speech engine.
 */
async function prepAsiOfflineDictation(
  candidates: readonly string[],
  androidPackage: string,
): Promise<LocalDictationPrep> {
  const preferred = normalizeSpeechLocaleTag(candidates[0] ?? 'en-US');
  let localeProbeFailed = false;

  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: androidPackage,
    });

    const installed = pickInstalledSpeechLocale(candidates, installedLocales);
    if (installed) {
      return readyOnDevice(installed, androidPackage);
    }
  } catch {
    // Locale probe can fail on some ROMs — fall through to download / optimistic start.
    localeProbeFailed = true;
  }

  try {
    const download = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: preferred,
    });

    if (download.status === 'download_success') {
      try {
        const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
          androidRecognitionServicePackage: androidPackage,
        });
        const installed = pickInstalledSpeechLocale(candidates, installedLocales);
        if (installed) {
          return readyOnDevice(installed, androidPackage);
        }
      } catch {
        // Use the requested locale if re-probe fails after a successful download.
      }
      return readyOnDevice(preferred, androidPackage);
    }

    if (download.status === 'opened_dialog') {
      return { ready: false, message: SPEECH_MSG.offlineModel };
    }

    return { ready: false, message: SPEECH_MSG.offlineCanceled };
  } catch {
    // Pack confirmed missing → guide the user. Probe failed → still attempt on-device.
    if (!localeProbeFailed) {
      return { ready: false, message: SPEECH_MSG.offlineModel };
    }
    return readyOnDevice(preferred, androidPackage);
  }
}

/**
 * Prepare on-device speech for note dictation (ASI offline only).
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
  if (!androidPackage) {
    return { ready: false, message: SPEECH_MSG.installOnDevice };
  }

  return prepAsiOfflineDictation(uniqueCandidates, androidPackage);
}
