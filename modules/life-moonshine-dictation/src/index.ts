import { Platform } from 'react-native';
import {
  type EventSubscription,
  NativeModule,
  requireNativeModule,
  UnavailabilityError,
} from 'expo-modules-core';

export type DictationStopResult = {
  text: string;
};

export type DictationPrepareResult = {
  ready: boolean;
};

export type DictationPartialEvent = {
  committed: string;
  tail: string;
};

export type DictationCapturingEvent = {
  capturing: boolean;
};

export type DictationTakeLimitEvent = {
  reason: 'characters' | 'duration';
};

export type DictationDownloadProgressEvent = {
  fraction: number;
  file?: string;
};

export type DictationErrorEvent = {
  message: string;
};

type MoonshineEvents = {
  onPartial: (event: DictationPartialEvent) => void;
  onCapturing: (event: DictationCapturingEvent) => void;
  onListening: () => void;
  onDownloadProgress: (event: DictationDownloadProgressEvent) => void;
  onTakeLimit: (event: DictationTakeLimitEvent) => void;
  onError: (event: DictationErrorEvent) => void;
};

declare class LifeMoonshineDictationModule extends NativeModule<MoonshineEvents> {
  isSupported(): boolean;
  prepare(): Promise<DictationPrepareResult>;
  warm(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<DictationStopResult>;
  abort(): Promise<void>;
  deleteLegacySpeechModels(): Promise<void>;
}

const NativeModuleImpl =
  Platform.OS === 'android'
    ? requireNativeModule<LifeMoonshineDictationModule>('LifeMoonshineDictation')
    : null;

function assertNative(): LifeMoonshineDictationModule {
  if (!NativeModuleImpl?.isSupported()) {
    throw new UnavailabilityError('LifeMoonshineDictation', 'native module');
  }
  return NativeModuleImpl;
}

function addListener<K extends keyof MoonshineEvents>(
  event: K,
  listener: MoonshineEvents[K],
): EventSubscription {
  if (!NativeModuleImpl) {
    return { remove: () => undefined };
  }
  return NativeModuleImpl.addListener(event, listener);
}

export function isMoonshineDictationSupported(): boolean {
  return Platform.OS === 'android' && Boolean(NativeModuleImpl?.isSupported());
}

export async function prepareMoonshineDictation(): Promise<DictationPrepareResult> {
  return assertNative().prepare();
}

export async function warmMoonshineDictation(): Promise<void> {
  if (!isMoonshineDictationSupported()) return;
  await NativeModuleImpl!.warm();
}

export async function startMoonshineDictation(): Promise<void> {
  await assertNative().start();
}

export async function stopMoonshineDictation(): Promise<DictationStopResult> {
  return assertNative().stop();
}

export async function abortMoonshineDictation(): Promise<void> {
  if (!isMoonshineDictationSupported()) return;
  await NativeModuleImpl!.abort();
}

export async function deleteLegacySpeechModels(): Promise<void> {
  if (!isMoonshineDictationSupported()) return;
  await NativeModuleImpl!.deleteLegacySpeechModels();
}

export function addMoonshinePartialListener(
  listener: (event: DictationPartialEvent) => void,
): EventSubscription {
  return addListener('onPartial', listener);
}

export function addMoonshineCapturingListener(
  listener: (event: DictationCapturingEvent) => void,
): EventSubscription {
  return addListener('onCapturing', listener);
}

export function addMoonshineListeningListener(listener: () => void): EventSubscription {
  return addListener('onListening', listener);
}

export function addMoonshineDownloadProgressListener(
  listener: (event: DictationDownloadProgressEvent) => void,
): EventSubscription {
  return addListener('onDownloadProgress', listener);
}

export function addMoonshineTakeLimitListener(
  listener: (event: DictationTakeLimitEvent) => void,
): EventSubscription {
  return addListener('onTakeLimit', listener);
}

export function addMoonshineErrorListener(
  listener: (event: DictationErrorEvent) => void,
): EventSubscription {
  return addListener('onError', listener);
}

export type { EventSubscription };
