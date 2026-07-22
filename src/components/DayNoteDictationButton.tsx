import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, IconButton, useTheme } from 'react-native-paper';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { joinDictationParts } from '../utils/appendTranscript';
import { polishDictationTranscript } from '../utils/polishDictationTranscript';
import {
  bestRecognitionTranscript,
  buildLocalNoteDictationOptions,
} from '../utils/speechRecognitionOptions';
import { ensureLocalDictationReady } from '../utils/speechRecognitionLocal';
import { speechRecognitionLocale } from '../utils/speechRecognitionLocale';

interface Props {
  disabled?: boolean;
  /** When false, abort any in-progress recognition (e.g. note sheet closed). */
  active?: boolean;
  /** Header layout: mic icon, Done while dictating. */
  compact?: boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string | null) => void;
}

function speechModuleAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

function abortRecognitionQuietly(): void {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    // Native module may be missing in Expo Go / web.
  }
}

/**
 * Mic dictation for notes — transcript only, no audio files stored.
 * Tap mic to record, Done to stop and append text.
 */
export default function DayNoteDictationButton({
  disabled,
  active = true,
  compact = false,
  onTranscript,
  onError,
}: Props) {
  const theme = useTheme();
  const [available, setAvailable] = useState(() => speechModuleAvailable());
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  /** Mic session open until the user taps Done (or the sheet closes). */
  const [sessionOpen, setSessionOpen] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const activeRef = useRef(active);
  activeRef.current = active;
  const blockedRef = useRef(Boolean(disabled || !active));
  blockedRef.current = Boolean(disabled || !active);
  const sessionPartsRef = useRef<string[]>([]);
  const finishingRef = useRef(false);

  const setError = useCallback((message: string | null) => {
    onErrorRef.current?.(message);
  }, []);

  const resetSession = useCallback(() => {
    sessionPartsRef.current = [];
    finishingRef.current = false;
    setSessionOpen(false);
    setListening(false);
    setStarting(false);
  }, []);

  const flushSession = useCallback(() => {
    const locale = speechRecognitionLocale();
    const raw = joinDictationParts(sessionPartsRef.current);
    const text = polishDictationTranscript(raw, locale);
    sessionPartsRef.current = [];
    finishingRef.current = false;
    setSessionOpen(false);
    setListening(false);
    setStarting(false);
    if (text) onTranscriptRef.current(text);
  }, []);

  useEffect(() => {
    setAvailable(speechModuleAvailable());
    return () => {
      abortRecognitionQuietly();
    };
  }, []);

  useEffect(() => {
    if (!active || disabled) {
      abortRecognitionQuietly();
      resetSession();
    }
  }, [active, disabled, resetSession]);

  useSpeechRecognitionEvent('start', () => {
    if (blockedRef.current) {
      abortRecognitionQuietly();
      return;
    }
    setStarting(false);
    setListening(true);
    setSessionOpen(true);
    setError(null);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setStarting(false);
    if (finishingRef.current) {
      flushSession();
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (blockedRef.current || !activeRef.current) return;
    if (!event.isFinal) return;
    const text = bestRecognitionTranscript(event.results);
    if (text) sessionPartsRef.current.push(text);
  });
  useSpeechRecognitionEvent('error', (event) => {
    resetSession();
    if (blockedRef.current || !activeRef.current) return;
    if (event.error === 'aborted' || event.error === 'no-speech') {
      setError(null);
      return;
    }
    if (event.error === 'not-allowed') {
      setError('Microphone permission needed');
      return;
    }
    setError(event.message || 'Could not transcribe');
  });

  const start = useCallback(async () => {
    if (sessionOpen || listening || starting) return;

    setError(null);
    setStarting(true);
    sessionPartsRef.current = [];
    finishingRef.current = false;
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (blockedRef.current || !activeRef.current) {
        resetSession();
        return;
      }
      if (!permission.granted) {
        setError('Microphone permission needed');
        resetSession();
        return;
      }
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setError('Speech recognition unavailable');
        resetSession();
        return;
      }
      const locale = speechRecognitionLocale();
      const prep = await ensureLocalDictationReady(locale);
      if (blockedRef.current || !activeRef.current) {
        resetSession();
        return;
      }
      if (!prep.ready) {
        setError(prep.message);
        resetSession();
        return;
      }
      ExpoSpeechRecognitionModule.start(
        buildLocalNoteDictationOptions(prep.locale, prep.androidPackage),
      );
    } catch {
      if (!blockedRef.current) {
        setError('Speech recognition unavailable');
      }
      resetSession();
    }
  }, [listening, resetSession, sessionOpen, setError, starting]);

  const finish = useCallback(() => {
    if (!sessionOpen) return;
    finishingRef.current = true;
    setError(null);
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        flushSession();
      }
      return;
    }
    flushSession();
  }, [flushSession, listening, sessionOpen, setError]);

  if (!available) {
    return null;
  }

  const busy = disabled || !active || starting;
  const showDone = sessionOpen;

  if (compact) {
    return (
      <View style={styles.compactRow}>
        {showDone ? (
          <Button
            mode="contained-tonal"
            compact
            onPress={finish}
            disabled={starting}
            accessibilityLabel="Finish dictation"
          >
            Done
          </Button>
        ) : null}
        <IconButton
          icon={listening ? 'microphone' : 'microphone-outline'}
          size={20}
          mode={listening ? 'contained' : undefined}
          iconColor={listening ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
          containerColor={listening ? theme.colors.primary : undefined}
          onPress={() => void start()}
          disabled={busy || sessionOpen || starting}
          accessibilityLabel="Dictate with microphone"
          style={styles.compactMic}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {showDone ? (
        <Button
          mode="contained-tonal"
          compact
          onPress={finish}
          disabled={starting}
          accessibilityLabel="Finish dictation"
        >
          Done
        </Button>
      ) : (
        <IconButton
          icon="microphone-outline"
          mode="outlined"
          iconColor={theme.colors.primary}
          onPress={() => void start()}
          disabled={busy}
          accessibilityLabel="Dictate with microphone"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactMic: {
    margin: 0,
  },
});
