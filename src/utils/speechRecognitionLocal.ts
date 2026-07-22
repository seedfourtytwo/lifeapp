import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import {
  localeIsInstalledForOffline,
  normalizeSpeechLocaleTag,
} from './speechRecognitionLocale';

/** Google on-device speech on Pixel / Android System Intelligence. */
export const ANDROID_ON_DEVICE_ASR_PACKAGE = 'com.google.android.as';

export type LocalDictationPrep =
  | { ready: true; locale: string; androidPackage?: string }
  | { ready: false; message: string };

function pickAndroidOnDevicePackage(): string | undefined {
  if (Platform.OS !== 'android') return undefined;
  try {
    const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    if (services.includes(ANDROID_ON_DEVICE_ASR_PACKAGE)) {
      return ANDROID_ON_DEVICE_ASR_PACKAGE;
    }
  } catch {
    // Fall through — requiresOnDeviceRecognition still uses system on-device engine.
  }
  return undefined;
}

let cachedAndroidPackage: string | undefined | null = null;

function resolveAndroidOnDevicePackage(): string | undefined {
  if (cachedAndroidPackage !== null) return cachedAndroidPackage ?? undefined;
  cachedAndroidPackage = pickAndroidOnDevicePackage();
  return cachedAndroidPackage ?? undefined;
}

/**
 * Ensure on-device speech models are ready. May open a system dialog on Android
 * to download the offline language pack — still fully local, no cloud STT.
 */
export async function ensureLocalDictationReady(
  locale: string,
): Promise<LocalDictationPrep> {
  const normalized = normalizeSpeechLocaleTag(locale);

  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
    return {
      ready: false,
      message: 'On-device speech recognition is not available on this device.',
    };
  }

  if (Platform.OS === 'ios') {
    return { ready: true, locale: normalized };
  }

  if (Platform.OS !== 'android') {
    return { ready: false, message: 'Speech recognition is not supported here.' };
  }

  const androidPackage = resolveAndroidOnDevicePackage();

  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
      ...(androidPackage ? { androidRecognitionServicePackage: androidPackage } : {}),
    });

    if (localeIsInstalledForOffline(normalized, installedLocales)) {
      return { ready: true, locale: normalized, androidPackage };
    }

    const download = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: normalized,
    });

    if (download.status === 'download_success') {
      return { ready: true, locale: normalized, androidPackage };
    }

    if (download.status === 'opened_dialog') {
      return {
        ready: false,
        message:
          'Download the offline voice model in the system dialog, then try dictation again.',
      };
    }

    return {
      ready: false,
      message: 'Offline voice model download was canceled.',
    };
  } catch {
    return {
      ready: false,
      message: 'Could not prepare on-device speech recognition.',
    };
  }
}
