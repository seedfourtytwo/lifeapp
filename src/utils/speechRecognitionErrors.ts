/**
 * User-facing dictation errors — short, actionable, no jargon.
 * Keep GrapheneOS / sandboxed Google speech in mind (separate mic permission).
 */

export const SPEECH_MSG = {
  webOnly:
    'Dictation works in the phone app, not in the browser.',
  moduleMissing:
    'Dictation needs a newer app install. Update Life Dashboard from the latest development APK.',
  notAvailable:
    'Speech recognition is not available. Install “Speech Recognition & synthesis” from Google Play, then enable it under Settings → System → Languages → Voice input.',
  installTts:
    'Install “Speech Recognition & synthesis” from Google Play, download your language under Offline speech recognition, then try again.',
  micLifeApp:
    'Allow Microphone for Life Dashboard: Settings → Apps → Life Dashboard → Permissions → Microphone.',
  micBoth:
    'Allow Microphone for Life Dashboard and for “Speech Recognition & synthesis” (Settings → Apps → each app → Permissions), then try again.',
  offlineModel:
    'Download the offline voice model in the system dialog (or in Speech Recognition & synthesis settings), then try dictation again.',
  offlineCanceled:
    'Offline voice model download was canceled. Open Speech Recognition & synthesis settings, download your language, then try again.',
  timedOut:
    'Speech recognition took too long to start. Check Microphone permission for Life Dashboard and Speech Recognition & synthesis, then try again.',
  unavailable:
    'Could not start speech recognition. Check that “Speech Recognition & synthesis” is installed and has Microphone permission.',
  language:
    'This language is not available for speech recognition. Download it in Speech Recognition & synthesis settings, then try again.',
  network:
    'Speech recognition needs network or an offline voice pack. Download your language offline in Speech Recognition & synthesis settings, or allow Network for that app.',
  busy:
    'Speech recognition is busy. Wait a moment, then try again.',
  generic:
    'Could not transcribe. Check Microphone permission for Life Dashboard and Speech Recognition & synthesis, then try again.',
  iosOnDevice:
    'On-device speech recognition is not available. Enable Dictation in iOS Settings → General → Keyboard.',
} as const;

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
