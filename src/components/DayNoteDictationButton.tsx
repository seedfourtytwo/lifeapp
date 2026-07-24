import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, useTheme } from 'react-native-paper';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
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
import { DictationMicHalo } from './dictation/DictationPresence';

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
  /** Polished phrase committed into the note (finals as they land, plus leftover interim on Done). */
  onTranscript: (text: string) => void;
  /** Partial hypothesis while listening — `null` clears Live Echo. */
  onInterim?: (text: string | null) => void;
  /** True while a dictation session is open (Done visible). */
  onSessionChange?: (open: boolean) => void;
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
 * Tap mic to listen; finals commit as they arrive; Done ends the session.
 */
export default function DayNoteDictationButton({
  disabled,
  active = true,
  autoStart = false,
  autoStartToken = null,
  onTranscript,
  onInterim,
  onSessionChange,
  onFinished,
  onError,
}: Props) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  /** Open until Done (or the sheet closes). */
  const [sessionOpen, setSessionOpen] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onInterimRef = useRef(onInterim);
  onInterimRef.current = onInterim;
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const activeRef = useRef(active);
  activeRef.current = active;
  const disabledRef = useRef(Boolean(disabled));
  disabledRef.current = Boolean(disabled);
  /** True while a session is open — `disabled` must not drop in-flight finals. */
  const sessionOpenRef = useRef(false);
  /** Latest interim hypothesis — committed on Done if the engine never finals it. */
  const interimRef = useRef('');
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

  const clearInterim = useCallback(() => {
    interimRef.current = '';
    onInterimRef.current?.(null);
  }, []);

  const publishInterim = useCallback((text: string | null) => {
    const next = text?.trim() ? text : null;
    interimRef.current = next ?? '';
    onInterimRef.current?.(next);
  }, []);

  const commitPhrase = useCallback((raw: string) => {
    const locale = speechRecognitionLocale();
    const text = polishDictationTranscript(raw, locale);
    if (!text) return;
    onTranscriptRef.current(text);
  }, []);

  const setSession = useCallback((open: boolean) => {
    sessionOpenRef.current = open;
    setSessionOpen(open);
    onSessionChangeRef.current?.(open);
  }, []);

  const resetSession = useCallback(() => {
    clearStartTimeout();
    clearInterim();
    finishingRef.current = false;
    setSession(false);
    setListening(false);
    setStarting(false);
  }, [clearInterim, clearStartTimeout, setSession]);

  const flushSession = useCallback(() => {
    clearStartTimeout();
    const leftover = interimRef.current.trim();
    clearInterim();
    finishingRef.current = false;
    setSession(false);
    setListening(false);
    setStarting(false);
    // stop() may still emit an error after end/flush — ignore briefly.
    ignoreErrorsUntilRef.current = Date.now() + 750;
    if (leftover) commitPhrase(leftover);
    onFinishedRef.current?.();
  }, [clearInterim, clearStartTimeout, commitPhrase, setSession]);

  useEffect(() => {
    return () => {
      clearStartTimeout();
      abortRecognitionQuietly();
    };
  }, [clearStartTimeout]);

  useEffect(() => {
    // Closing the sheet (`active=false`) must abort. `disabled` only blocks *new*
    // starts (via `busy`) — it must not kill an in-flight session (e.g. atLimit
    // after a flush, or saving briefly disables the control).
    if (!active) {
      abortRecognitionQuietly();
      resetSession();
    }
  }, [active, resetSession]);

  useSpeechRecognitionEvent('start', () => {
    // Abort only if the sheet closed, or a *new* start raced past a disable.
    if (!activeRef.current || (disabledRef.current && !sessionOpenRef.current)) {
      abortRecognitionQuietly();
      return;
    }
    clearStartTimeout();
    setStarting(false);
    setListening(true);
    setSession(true);
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
    if (!activeRef.current) return;
    const text = bestRecognitionTranscript(event.results);
    if (!event.isFinal) {
      publishInterim(text || null);
      return;
    }
    // Final segment — clear wet ink and commit into the note immediately.
    publishInterim(null);
    if (text) commitPhrase(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!activeRef.current) {
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
    // Benign codes (no-speech / aborted) during an open session: keep commits, stay on Done.
    if (mapped == null) {
      setListening(false);
      setStarting(false);
      clearInterim();
      setError(null);
      return;
    }
    clearAndroidRecognitionPackageCache();
    resetSession();
    setError(mapped);
  });

  const start = useCallback(async () => {
    if (sessionOpen || listening || starting || disabledRef.current || !activeRef.current) {
      return;
    }

    const probe = probeSpeechAvailability();
    if (!probe.ok) {
      setError(probe.reason);
      return;
    }

    setError(null);
    setStarting(true);
    clearInterim();
    finishingRef.current = false;
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (disabledRef.current || !activeRef.current) {
        resetSession();
        return;
      }
      if (!permission.granted) {
        setError(SPEECH_MSG.micLifeApp);
        resetSession();
        return;
      }
      const prep = await ensureLocalDictationReady();
      if (disabledRef.current || !activeRef.current) {
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
        if (!disabledRef.current && activeRef.current) {
          setError(SPEECH_MSG.timedOut);
        }
      }, START_TIMEOUT_MS);
      ExpoSpeechRecognitionModule.start(
        buildLocalNoteDictationOptions(prep.locale, prep.androidPackage),
      );
    } catch {
      clearAndroidRecognitionPackageCache();
      if (!disabledRef.current && activeRef.current) {
        setError(SPEECH_MSG.unavailable);
      }
      resetSession();
    }
  }, [
    clearInterim,
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
      if (cancelled || disabledRef.current || !activeRef.current) return;
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
  const live = listening || starting;
  const idleMicColor = theme.colors.onSurfaceVariant;
  const liveMicColor = theme.dark ? '#8B7BB8' : '#5B4B8A';

  return (
    <View style={styles.row}>
      {showDone ? (
        <Button
          mode="contained-tonal"
          compact
          onPress={finish}
          disabled={starting}
          accessibilityLabel={t('note.finishDictation')}
        >
          {t('actions.done')}
        </Button>
      ) : null}
      <DictationMicHalo active={live} color={liveMicColor}>
        <IconButton
          icon={live ? 'microphone' : 'microphone-outline'}
          size={22}
          mode={live ? 'contained-tonal' : 'outlined'}
          iconColor={live ? liveMicColor : idleMicColor}
          onPress={() => void start()}
          disabled={busy || sessionOpen}
          accessibilityLabel={t('note.dictateWithMic')}
          style={styles.mic}
        />
      </DictationMicHalo>
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
