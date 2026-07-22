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
  messageForSpeechRecognitionError,
  SPEECH_MSG,
} from '../utils/speechRecognitionErrors';
import {
  bestRecognitionTranscript,
  buildLocalNoteDictationOptions,
} from '../utils/speechRecognitionOptions';
import {
  clearAndroidRecognitionPackageCache,
  ensureLocalDictationReady,
} from '../utils/speechRecognitionLocal';
import { speechRecognitionLocale } from '../utils/speechRecognitionLocale';

/** How long to wait for the native `start` event before aborting. */
const START_TIMEOUT_MS = 12_000;

interface Props {
  disabled?: boolean;
  /** When false, abort recognition (e.g. note sheet closed). */
  active?: boolean;
  /** Start listening once when the sheet opens via the Home mic shortcut. */
  autoStart?: boolean;
  /** Stable token so auto-start runs once per open, not after Done. */
  autoStartToken?: string | null;
  onTranscript: (text: string) => void;
  /** Called after Done finishes a session (even when no speech was captured). */
  onFinished?: () => void;
  onError?: (message: string | null) => void;
}

type SpeechAvailability =
  | { ok: true }
  | { ok: false; reason: string };

/** Probe the native module — never throw; always return a clear reason. */
function probeSpeechAvailability(): SpeechAvailability {
  if (Platform.OS === 'web') {
    return { ok: false, reason: SPEECH_MSG.webOnly };
  }
  try {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      return { ok: false, reason: SPEECH_MSG.notAvailable };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: SPEECH_MSG.moduleMissing };
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
 * Mic dictation for notes — transcript only (no audio stored).
 * Tap mic to record; Done to stop and append polished text.
 */
export default function DayNoteDictationButton({
  disabled,
  active = true,
  autoStart = false,
  autoStartToken = null,
  onTranscript,
  onFinished,
  onError,
}: Props) {
  const theme = useTheme();
  const [availability, setAvailability] = useState<SpeechAvailability>(() =>
    probeSpeechAvailability(),
  );
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  /** Open until Done (or the sheet closes) — keeps continuous segments together. */
  const [sessionOpen, setSessionOpen] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const activeRef = useRef(active);
  activeRef.current = active;
  const blockedRef = useRef(Boolean(disabled || !active));
  blockedRef.current = Boolean(disabled || !active);
  const sessionPartsRef = useRef<string[]>([]);
  const finishingRef = useRef(false);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoStartTokenRef = useRef<string | null>(null);
  /** Ignore stray stop() errors after a successful flush. */
  const ignoreErrorsUntilRef = useRef(0);
  const startRef = useRef<() => Promise<void>>(async () => {});

  const setError = useCallback((message: string | null) => {
    onErrorRef.current?.(message);
  }, []);

  const clearStartTimeout = useCallback(() => {
    if (startTimeoutRef.current != null) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    clearStartTimeout();
    sessionPartsRef.current = [];
    finishingRef.current = false;
    setSessionOpen(false);
    setListening(false);
    setStarting(false);
  }, [clearStartTimeout]);

  const flushSession = useCallback(() => {
    clearStartTimeout();
    const locale = speechRecognitionLocale();
    const raw = joinDictationParts(sessionPartsRef.current);
    const text = polishDictationTranscript(raw, locale);
    sessionPartsRef.current = [];
    finishingRef.current = false;
    setSessionOpen(false);
    setListening(false);
    setStarting(false);
    // stop() may still emit an error after end/flush — ignore briefly.
    ignoreErrorsUntilRef.current = Date.now() + 750;
    if (text) onTranscriptRef.current(text);
    onFinishedRef.current?.();
  }, [clearStartTimeout]);

  useEffect(() => {
    setAvailability(probeSpeechAvailability());
    return () => {
      clearStartTimeout();
      abortRecognitionQuietly();
    };
  }, [clearStartTimeout]);

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
    clearStartTimeout();
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
    if (blockedRef.current || !activeRef.current) {
      resetSession();
      return;
    }
    // stop() after Done often emits benign errors even when finals exist — keep text.
    if (finishingRef.current) {
      flushSession();
      setError(null);
      return;
    }
    if (Date.now() < ignoreErrorsUntilRef.current) {
      return;
    }
    const mapped = messageForSpeechRecognitionError(event.error, event.message);
    // Benign codes (no-speech / aborted) during an open session: keep finals, stay on Done.
    if (mapped == null) {
      setListening(false);
      setStarting(false);
      setError(null);
      return;
    }
    clearAndroidRecognitionPackageCache();
    resetSession();
    setError(mapped);
  });

  const start = useCallback(async () => {
    if (sessionOpen || listening || starting) return;

    const probe = probeSpeechAvailability();
    setAvailability(probe);
    if (!probe.ok) {
      setError(probe.reason);
      return;
    }

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
        setError(SPEECH_MSG.micLifeApp);
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
        clearAndroidRecognitionPackageCache();
        setError(prep.message);
        resetSession();
        return;
      }
      clearStartTimeout();
      startTimeoutRef.current = setTimeout(() => {
        startTimeoutRef.current = null;
        abortRecognitionQuietly();
        clearAndroidRecognitionPackageCache();
        resetSession();
        if (!blockedRef.current && activeRef.current) {
          setError(SPEECH_MSG.timedOut);
        }
      }, START_TIMEOUT_MS);
      ExpoSpeechRecognitionModule.start(
        buildLocalNoteDictationOptions(
          prep.locale,
          prep.androidPackage,
          prep.requiresOnDeviceRecognition,
        ),
      );
    } catch {
      clearAndroidRecognitionPackageCache();
      if (!blockedRef.current) {
        setError(SPEECH_MSG.unavailable);
      }
      resetSession();
    }
  }, [
    clearStartTimeout,
    listening,
    resetSession,
    sessionOpen,
    setError,
    starting,
  ]);

  startRef.current = start;

  // One-shot auto-start for Home mic shortcut (token changes per open).
  // Omit session/listening deps so Done cannot re-trigger start(). Microtask + cleanup
  // keeps React Strict Mode's setup/cleanup/setup from skipping the second arm.
  useEffect(() => {
    if (!autoStart || !autoStartToken || !active || disabled) {
      if (!autoStartToken || !active) lastAutoStartTokenRef.current = null;
      return;
    }
    if (autoStartToken === lastAutoStartTokenRef.current) return;

    let cancelled = false;
    lastAutoStartTokenRef.current = autoStartToken;
    const timer = setTimeout(() => {
      if (cancelled || blockedRef.current || !activeRef.current) return;
      void startRef.current();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Undo arm on Strict Mode cleanup so the second setup can schedule again.
      if (lastAutoStartTokenRef.current === autoStartToken) {
        lastAutoStartTokenRef.current = null;
      }
    };
  }, [active, autoStart, autoStartToken, disabled]);

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

  if (Platform.OS === 'web') {
    return null;
  }

  const busy = disabled || !active || starting;
  const showDone = sessionOpen;
  const micColor = listening
    ? theme.colors.onPrimary
    : availability.ok
      ? theme.colors.primary
      : theme.colors.onSurfaceVariant;

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
      ) : null}
      <IconButton
        icon={listening ? 'microphone' : 'microphone-outline'}
        size={22}
        mode={listening ? 'contained' : 'outlined'}
        iconColor={micColor}
        containerColor={listening ? theme.colors.primary : undefined}
        onPress={() => void start()}
        disabled={busy || sessionOpen}
        accessibilityLabel="Dictate with microphone"
        style={styles.mic}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mic: {
    margin: 0,
  },
});
