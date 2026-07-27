import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getSpeechLocaleCandidates } from '../i18n';
import { pickAndroidRecognitionPackage } from './speechRecognitionAndroid';
import { SPEECH_MSG } from './speechRecognitionErrors';
import {
  defaultBilingualSwitchLocales,
  normalizeSpeechLocaleTag,
  pickInstalledSpeechLocale,
  resolveBilingualSwitchLocales,
  supportsBilingualDictationSwitch,
} from './speechRecognitionLocale';

export type LocalDictationPrep =
  | {
      ready: true;
      locale: string;
      androidPackage?: string;
      /**
       * Installed EN+FR locales for Android 14+ language switch (same note).
       * Omitted when only one language pack is available.
       */
      switchLocales?: string[];
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

function supportsSystemOnDeviceRecognition(): boolean {
  try {
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {
    return false;
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

function switchLocalesFor(
  primaryLocale: string,
  installedLocales: readonly string[] | null,
  opts: { onDeviceApi: boolean; allowOptimisticPair: boolean },
): string[] | undefined {
  if (!supportsBilingualDictationSwitch()) return undefined;

  if (installedLocales && installedLocales.length > 0) {
    return resolveBilingualSwitchLocales(primaryLocale, installedLocales);
  }

  // Locale listing can fail or return [] while packs still work (prod visibility quirks).
  if (opts.onDeviceApi && opts.allowOptimisticPair) {
    return defaultBilingualSwitchLocales(primaryLocale);
  }
  return undefined;
}

function readyOnDevice(
  locale: string,
  androidPackage: string | undefined,
  switchLocales?: string[],
): LocalDictationPrep {
  return {
    ready: true,
    locale,
    ...(androidPackage ? { androidPackage } : {}),
    ...(switchLocales && switchLocales.length >= 2 ? { switchLocales } : {}),
    requiresOnDeviceRecognition: true,
  };
}

async function probeInstalledLocales(
  androidPackage: string | undefined,
): Promise<string[] | null> {
  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales(
      androidPackage ? { androidRecognitionServicePackage: androidPackage } : {},
    );
    return installedLocales;
  } catch {
    return null;
  }
}

/**
 * Prepare ASI / system on-device offline recognition.
 * Missing pack → install/download guidance. Never falls back to a network engine.
 */
async function prepOnDeviceDictation(
  candidates: readonly string[],
  androidPackage: string | undefined,
  onDeviceApi: boolean,
): Promise<LocalDictationPrep> {
  const preferred = normalizeSpeechLocaleTag(candidates[0] ?? 'en-US');
  const probed = await probeInstalledLocales(androidPackage);

  if (probed != null && probed.length > 0) {
    const installed = pickInstalledSpeechLocale(candidates, probed);
    if (installed) {
      return readyOnDevice(
        installed,
        androidPackage,
        switchLocalesFor(installed, probed, {
          onDeviceApi,
          allowOptimisticPair: false,
        }),
      );
    }
  }

  // Listing empty/failed but system on-device works → start anyway (avoid false “install”).
  if (onDeviceApi && (probed == null || probed.length === 0)) {
    return readyOnDevice(
      preferred,
      androidPackage,
      switchLocalesFor(preferred, probed, {
        onDeviceApi,
        allowOptimisticPair: true,
      }),
    );
  }

  try {
    const download = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: preferred,
    });

    if (download.status === 'download_success') {
      const reprobed = await probeInstalledLocales(androidPackage);
      const installed =
        reprobed && reprobed.length > 0
          ? pickInstalledSpeechLocale(candidates, reprobed)
          : null;
      const locale = installed ?? preferred;
      return readyOnDevice(
        locale,
        androidPackage,
        switchLocalesFor(locale, reprobed, {
          onDeviceApi,
          allowOptimisticPair: true,
        }),
      );
    }

    if (download.status === 'opened_dialog') {
      return { ready: false, message: SPEECH_MSG.offlineModel };
    }

    return { ready: false, message: SPEECH_MSG.offlineCanceled };
  } catch {
    if (onDeviceApi) {
      return readyOnDevice(
        preferred,
        androidPackage,
        switchLocalesFor(preferred, null, {
          onDeviceApi,
          allowOptimisticPair: true,
        }),
      );
    }
    return { ready: false, message: SPEECH_MSG.offlineModel };
  }
}

/**
 * Prepare on-device speech for note dictation (system on-device / ASI offline only).
 *
 * Prefer Android's on-device recognizer API when available — do not require the ASI
 * package to appear in `getSpeechRecognitionServices()` (prod package visibility /
 * GrapheneOS can hide it while `createOnDeviceSpeechRecognizer` still works).
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
  const onDeviceApi = supportsSystemOnDeviceRecognition();

  if (!onDeviceApi && !androidPackage) {
    return { ready: false, message: SPEECH_MSG.installOnDevice };
  }

  return prepOnDeviceDictation(uniqueCandidates, androidPackage, onDeviceApi);
}
