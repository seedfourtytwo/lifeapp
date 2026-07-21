import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { speechRecognitionLocale } from '../utils/speechRecognitionLocale';

interface Props {
  disabled?: boolean;
  /** When false, abort any in-progress recognition (e.g. note sheet closed). */
  active?: boolean;
  onTranscript: (text: string) => void;
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
 * Press-to-talk mic for note dictation. Appends final transcripts only;
 * never records or stores audio files.
 */
export default function DayNoteDictationButton({
  disabled,
  active = true,
  onTranscript,
}: Props) {
  const theme = useTheme();
  const [available, setAvailable] = useState(() => speechModuleAvailable());
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const activeRef = useRef(active);
  activeRef.current = active;
  const blockedRef = useRef(Boolean(disabled || !active));
  blockedRef.current = Boolean(disabled || !active);

  useEffect(() => {
    setAvailable(speechModuleAvailable());
    return () => {
      abortRecognitionQuietly();
    };
  }, []);

  useEffect(() => {
    if (!active || disabled) {
      abortRecognitionQuietly();
      setListening(false);
      setStarting(false);
    }
  }, [active, disabled]);

  useSpeechRecognitionEvent('start', () => {
    if (blockedRef.current) {
      abortRecognitionQuietly();
      return;
    }
    setStarting(false);
    setListening(true);
    setError(null);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setStarting(false);
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (blockedRef.current || !activeRef.current) return;
    if (!event.isFinal) return;
    const text = event.results[0]?.transcript?.trim();
    if (text) onTranscriptRef.current(text);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    setStarting(false);
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

  const toggle = useCallback(async () => {
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        setListening(false);
      }
      return;
    }
    if (starting) return;

    setError(null);
    setStarting(true);
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      // Sheet may have closed while the permission dialog was open.
      if (blockedRef.current || !activeRef.current) {
        setStarting(false);
        return;
      }
      if (!permission.granted) {
        setError('Microphone permission needed');
        setStarting(false);
        return;
      }
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setError('Speech recognition unavailable');
        setStarting(false);
        return;
      }
      if (blockedRef.current || !activeRef.current) {
        setStarting(false);
        return;
      }
      // No recording options — transcript only, discard audio.
      ExpoSpeechRecognitionModule.start({
        lang: speechRecognitionLocale(),
        interimResults: false,
        continuous: false,
      });
    } catch {
      setStarting(false);
      if (!blockedRef.current) {
        setError('Speech recognition unavailable');
      }
    }
  }, [listening, starting]);

  if (!available) {
    return null;
  }

  const busy = disabled || !active || starting;

  return (
    <View style={styles.row}>
      <IconButton
        icon={listening ? 'microphone' : 'microphone-outline'}
        mode={listening ? 'contained' : 'outlined'}
        iconColor={listening ? theme.colors.onPrimary : theme.colors.primary}
        containerColor={listening ? theme.colors.primary : undefined}
        onPress={() => void toggle()}
        disabled={busy && !listening}
        accessibilityLabel={listening ? 'Stop dictation' : 'Dictate note'}
      />
      <Text
        variant="bodySmall"
        accessibilityLiveRegion="polite"
        style={{ color: error ? theme.colors.error : theme.colors.onSurfaceVariant, flex: 1 }}
      >
        {error
          ? error
          : starting
            ? 'Starting mic…'
            : listening
              ? 'Listening… tap mic to stop'
              : 'Tap mic to dictate (text only)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
