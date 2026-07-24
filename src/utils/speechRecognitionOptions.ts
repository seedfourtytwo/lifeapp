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
 * Always on-device (`requiresOnDeviceRecognition: true`).
 */
export function buildLocalNoteDictationOptions(
  locale = speechRecognitionLocale(),
  androidPackage?: string,
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
    ...(Platform.OS === 'android' && androidPackage
      ? { androidRecognitionServicePackage: androidPackage }
      : {}),
  };
}
