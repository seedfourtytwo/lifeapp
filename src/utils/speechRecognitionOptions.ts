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
 * Recognition options for journal/note dictation.
 * Prefer on-device when the engine supports it (`requiresOnDeviceRecognition`).
 * Google TTS fallbacks may use the engine default path (local packs when present).
 */
export function buildLocalNoteDictationOptions(
  locale = speechRecognitionLocale(),
  androidPackage?: string,
  requiresOnDeviceRecognition = true,
): ExpoSpeechRecognitionOptions {
  return {
    lang: locale,
    interimResults: false,
    continuous: supportsContinuousDictation(),
    addsPunctuation: true,
    maxAlternatives: 5,
    requiresOnDeviceRecognition,
    iosTaskHint: 'dictation',
    ...(Platform.OS === 'android' && androidPackage
      ? { androidRecognitionServicePackage: androidPackage }
      : {}),
  };
}
