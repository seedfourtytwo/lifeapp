import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { isMoonshineDictationSupported } from 'life-moonshine-dictation';
import { polishDictationTranscript } from '../utils/polishDictationTranscript';
import { DICTATION_MSG, messageForDictationError } from './messages';
import { ensureMoonshineDictationReady, preloadMoonshineDictation } from './ensureMoonshineModel';
import { requestDictationMicPermission } from './requestMicPermission';
import { openMoonshineDictationSession } from './moonshineSession';
import { MOONSHINE_NOTE_STT_LOCALE } from './moonshineModel';
import {
  DICTATION_TAKE_MAX_CHARS,
  DICTATION_TAKE_MAX_MS,
  DICTATION_TAKE_WARN_MS,
} from './limits';
import {
  livePreviewLength,
  livePreviewsEqual,
  type DictationLivePreview,
} from './livePreview';
import type {
  DictationPrepStatus,
  DictationTakeLimitReason,
  MoonshineDictationSession,
} from './types';

const START_TIMEOUT_MS = 20_000;
const FINISHING_UI_DELAY_MS = 300;

export type NoteDictationControllerProps = {
  disabled?: boolean;
  active?: boolean;
  autoStart?: boolean;
  autoStartToken?: string | null;
  /** Characters still allowed in the note (excludes the current live take). */
  noteRoomChars?: number;
  onTranscript: (text: string) => void;
  onLive?: (live: DictationLivePreview | null) => void;
  onSessionChange?: (open: boolean) => void;
  /** True from mic prep through session teardown (blocks sheet dismiss). */
  onActiveChange?: (active: boolean) => void;
  onCapturingChange?: (capturing: boolean) => void;
  onFinished?: () => void;
  onError?: (message: string | null) => void;
  onStatus?: (status: DictationPrepStatus | null) => void;
  onTakeWarning?: () => void;
  onTakeLimit?: (reason: DictationTakeLimitReason) => void;
};

export type NoteDictationController = {
  listening: boolean;
  capturing: boolean;
  starting: boolean;
  finishing: boolean;
  sessionOpen: boolean;
  start: () => Promise<void>;
  /** Commit the current take (Done). */
  finish: () => void;
  /** Drop the current take without committing (Clear while mic is open). */
  cancel: () => void;
  supported: boolean;
};

function probeSpeechAvailability(): { ok: true } | { ok: false; reason: string } {
  if (Platform.OS === 'web') {
    return { ok: false, reason: DICTATION_MSG.webOnly };
  }
  if (!isMoonshineDictationSupported()) {
    return { ok: false, reason: DICTATION_MSG.notAvailable };
  }
  return { ok: true };
}

function nativeErrorCode(error: unknown): string {
  if (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return 'client';
}

/**
 * Note mic session: prep model → listen → live preview → Done commits once.
 */
export function useNoteDictationController({
  disabled = false,
  active = true,
  autoStart = false,
  autoStartToken = null,
  noteRoomChars,
  onTranscript,
  onLive,
  onSessionChange,
  onActiveChange,
  onCapturingChange,
  onFinished,
  onError,
  onStatus,
  onTakeWarning,
  onTakeLimit,
}: NoteDictationControllerProps): NoteDictationController {
  const [listening, setListening] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onLiveRef = useRef(onLive);
  onLiveRef.current = onLive;
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  const onCapturingChangeRef = useRef(onCapturingChange);
  onCapturingChangeRef.current = onCapturingChange;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onTakeWarningRef = useRef(onTakeWarning);
  onTakeWarningRef.current = onTakeWarning;
  const onTakeLimitRef = useRef(onTakeLimit);
  onTakeLimitRef.current = onTakeLimit;
  const activeRef = useRef(active);
  activeRef.current = active;
  const disabledRef = useRef(Boolean(disabled));
  disabledRef.current = Boolean(disabled);
  const noteRoomCharsRef = useRef(noteRoomChars);
  noteRoomCharsRef.current = noteRoomChars;
  const sessionOpenRef = useRef(false);
  const startingRef = useRef(false);
  const startGenRef = useRef(0);
  const recognitionLocaleRef = useRef<string>(MOONSHINE_NOTE_STT_LOCALE);
  const finishingRef = useRef(false);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingUiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takeWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takeMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoStartTokenRef = useRef<string | null>(null);
  const ignoreErrorsUntilRef = useRef(0);
  const startRef = useRef<() => Promise<void>>(async () => {});
  const finishRef = useRef<() => void>(() => {});
  const sessionRef = useRef<MoonshineDictationSession | null>(null);
  const prepAbortRef = useRef<AbortController | null>(null);
  const preloadAbortRef = useRef<AbortController | null>(null);
  const didEndRef = useRef(false);
  const pendingLiveRef = useRef<DictationLivePreview | null | undefined>(undefined);
  const lastPublishedLiveRef = useRef<DictationLivePreview | null>(null);
  const displayFrameRef = useRef<number | null>(null);

  const flushDisplay = useCallback(() => {
    displayFrameRef.current = null;
    const next = pendingLiveRef.current;
    if (next === undefined) return;
    pendingLiveRef.current = undefined;
    const normalized =
      next && (next.committed || next.tail)
        ? { committed: next.committed, tail: next.tail }
        : null;
    if (livePreviewsEqual(normalized, lastPublishedLiveRef.current)) return;
    lastPublishedLiveRef.current = normalized;
    onLiveRef.current?.(normalized);
  }, []);

  const publishLive = useCallback(
    (live: DictationLivePreview | null) => {
      pendingLiveRef.current = live;
      if (displayFrameRef.current != null) return;
      displayFrameRef.current = requestAnimationFrame(flushDisplay);
    },
    [flushDisplay],
  );

  const clearDisplayPump = useCallback(() => {
    if (displayFrameRef.current != null) {
      cancelAnimationFrame(displayFrameRef.current);
      displayFrameRef.current = null;
    }
    pendingLiveRef.current = undefined;
    lastPublishedLiveRef.current = null;
  }, []);

  const setError = useCallback((message: string | null) => {
    onErrorRef.current?.(message);
  }, []);

  const setStatus = useCallback((status: DictationPrepStatus | null) => {
    onStatusRef.current?.(status);
  }, []);

  const clearTimer = (ref: { current: ReturnType<typeof setTimeout> | null }) => {
    if (ref.current != null) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearStartTimeout = useCallback(() => {
    clearTimer(startTimeoutRef);
  }, []);

  const clearFinishingUiTimer = useCallback(() => {
    clearTimer(finishingUiTimerRef);
  }, []);

  const clearTakeTimers = useCallback(() => {
    clearTimer(takeWarnTimerRef);
    clearTimer(takeMaxTimerRef);
  }, []);

  const armTakeTimers = useCallback(() => {
    clearTakeTimers();
    takeWarnTimerRef.current = setTimeout(() => {
      takeWarnTimerRef.current = null;
      if (!sessionOpenRef.current || finishingRef.current) return;
      onTakeWarningRef.current?.();
    }, DICTATION_TAKE_WARN_MS);
    takeMaxTimerRef.current = setTimeout(() => {
      takeMaxTimerRef.current = null;
      if (!sessionOpenRef.current || finishingRef.current) return;
      onTakeLimitRef.current?.('duration');
      finishRef.current();
    }, DICTATION_TAKE_MAX_MS);
  }, [clearTakeTimers]);

  const commitPhrase = useCallback((raw: string) => {
    const text = polishDictationTranscript(raw, recognitionLocaleRef.current);
    if (!text) return;
    onTranscriptRef.current(text);
  }, []);

  const setActive = useCallback((value: boolean) => {
    onActiveChangeRef.current?.(value);
  }, []);

  const publishCapturing = useCallback((value: boolean) => {
    setCapturing(value);
    onCapturingChangeRef.current?.(value);
  }, []);

  const setSession = useCallback((open: boolean) => {
    sessionOpenRef.current = open;
    setSessionOpen(open);
    onSessionChangeRef.current?.(open);
  }, []);

  const abortSessionQuietly = useCallback(() => {
    startGenRef.current += 1;
    prepAbortRef.current?.abort();
    prepAbortRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      void session.abort();
    }
  }, []);

  const clearSessionUi = useCallback(() => {
    finishingRef.current = false;
    startingRef.current = false;
    publishCapturing(false);
    setSession(false);
    setListening(false);
    setStarting(false);
    setFinishing(false);
  }, [publishCapturing, setSession]);

  const resetSession = useCallback(() => {
    clearStartTimeout();
    clearFinishingUiTimer();
    clearTakeTimers();
    clearDisplayPump();
    publishLive(null);
    didEndRef.current = false;
    recognitionLocaleRef.current = MOONSHINE_NOTE_STT_LOCALE;
    setActive(false);
    clearSessionUi();
  }, [
    clearDisplayPump,
    clearFinishingUiTimer,
    clearSessionUi,
    clearStartTimeout,
    clearTakeTimers,
    publishLive,
    setActive,
  ]);

  const flushSession = useCallback(() => {
    if (didEndRef.current) return;
    didEndRef.current = true;
    clearStartTimeout();
    clearFinishingUiTimer();
    clearTakeTimers();
    clearDisplayPump();
    publishLive(null);
    setActive(false);
    clearSessionUi();
    setStatus(null);
    ignoreErrorsUntilRef.current = Date.now() + 750;
    onFinishedRef.current?.();
  }, [
    clearDisplayPump,
    clearFinishingUiTimer,
    clearSessionUi,
    clearStartTimeout,
    clearTakeTimers,
    publishLive,
    setActive,
    setStatus,
  ]);

  const maybeFinishForLength = useCallback(
    (live: DictationLivePreview | null) => {
      const liveChars = livePreviewLength(live);
      if (liveChars <= 0) return;
      const room = noteRoomCharsRef.current;
      if (liveChars >= DICTATION_TAKE_MAX_CHARS) {
        onTakeLimitRef.current?.('characters');
        finishRef.current();
        return;
      }
      if (room != null && liveChars >= room) {
        finishRef.current();
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      clearStartTimeout();
      clearFinishingUiTimer();
      clearTakeTimers();
      clearDisplayPump();
      if (finishingRef.current) {
        prepAbortRef.current?.abort();
        prepAbortRef.current = null;
        return;
      }
      abortSessionQuietly();
    };
  }, [
    abortSessionQuietly,
    clearDisplayPump,
    clearFinishingUiTimer,
    clearStartTimeout,
    clearTakeTimers,
  ]);

  useEffect(() => {
    if (!active) {
      if (finishingRef.current) return;
      abortSessionQuietly();
      resetSession();
      setStatus(null);
      setError(null);
    }
  }, [active, abortSessionQuietly, resetSession, setError, setStatus]);

  useEffect(() => {
    if (!active || disabled) return;
    preloadAbortRef.current?.abort();
    const ac = new AbortController();
    preloadAbortRef.current = ac;
    void preloadMoonshineDictation(ac.signal);
    return () => {
      ac.abort();
      if (preloadAbortRef.current === ac) {
        preloadAbortRef.current = null;
      }
    };
  }, [active, disabled]);

  const start = useCallback(async () => {
    if (
      sessionOpenRef.current ||
      startingRef.current ||
      disabledRef.current ||
      !activeRef.current
    ) {
      return;
    }

    const probe = probeSpeechAvailability();
    if (!probe.ok) {
      setError(probe.reason);
      return;
    }

    const gen = ++startGenRef.current;
    startingRef.current = true;
    setActive(true);
    setError(null);
    setStatus(null);
    setStarting(true);
    publishCapturing(false);
    publishLive(null);
    finishingRef.current = false;
    didEndRef.current = false;

    const isStale = () => gen !== startGenRef.current;
    prepAbortRef.current?.abort();
    const prepAbort = new AbortController();
    prepAbortRef.current = prepAbort;

    try {
      const granted = await requestDictationMicPermission();
      if (isStale() || disabledRef.current || !activeRef.current) {
        resetSession();
        return;
      }
      if (!granted) {
        setError(DICTATION_MSG.micLifeApp);
        resetSession();
        return;
      }

      const prep = await ensureMoonshineDictationReady({
        signal: prepAbort.signal,
        onStatus: (status) => {
          if (!isStale() && !disabledRef.current && activeRef.current) {
            setStatus(status);
          }
        },
      });
      if (isStale() || disabledRef.current || !activeRef.current) {
        resetSession();
        return;
      }
      if (!prep.ready) {
        setStatus(null);
        if (!prep.aborted) {
          setError(prep.message);
        }
        resetSession();
        return;
      }

      setStatus(null);
      recognitionLocaleRef.current = prep.locale;

      clearStartTimeout();
      startTimeoutRef.current = setTimeout(() => {
        startTimeoutRef.current = null;
        if (isStale()) return;
        abortSessionQuietly();
        resetSession();
        setStatus(null);
        if (!disabledRef.current && activeRef.current) {
          setError(DICTATION_MSG.timedOut);
        }
      }, START_TIMEOUT_MS);

      const { session, activate } = openMoonshineDictationSession({
        onListening: () => {
          if (isStale() || !activeRef.current || disabledRef.current) {
            return;
          }
          clearStartTimeout();
          startingRef.current = false;
          setStarting(false);
          setListening(true);
          setSession(true);
          setError(null);
          setStatus(null);
          armTakeTimers();
        },
        onDisplay: (live) => {
          if (isStale()) return;
          if (!activeRef.current && !finishingRef.current) return;
          publishLive(live);
          if (!finishingRef.current) {
            maybeFinishForLength(live);
          }
        },
        onCapturing: (value) => {
          if (isStale()) return;
          publishCapturing(value);
        },
        onTakeLimit: (reason) => {
          if (isStale() || finishingRef.current) return;
          onTakeLimitRef.current?.(reason);
          finishRef.current();
        },
        onError: (message) => {
          if (isStale()) return;
          if (finishingRef.current) {
            flushSession();
            setError(null);
            setStatus(null);
            return;
          }
          if (!activeRef.current) {
            resetSession();
            return;
          }
          if (Date.now() < ignoreErrorsUntilRef.current) {
            return;
          }
          const mapped = messageForDictationError('client', message);
          abortSessionQuietly();
          resetSession();
          setStatus(null);
          setError(mapped ?? DICTATION_MSG.generic);
        },
      });
      sessionRef.current = session;

      await activate();

      if (isStale() || !activeRef.current || disabledRef.current) {
        await session.abort();
        if (!isStale()) {
          resetSession();
          setStatus(null);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[dictation] start failed', error);
      }
      if (!isStale() && !disabledRef.current && activeRef.current) {
        setStatus(null);
        const detail =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : null;
        setError(
          messageForDictationError(nativeErrorCode(error), detail) ??
            DICTATION_MSG.unavailable,
        );
      }
      if (!isStale()) {
        abortSessionQuietly();
        resetSession();
      }
    }
  }, [
    abortSessionQuietly,
    armTakeTimers,
    clearStartTimeout,
    flushSession,
    maybeFinishForLength,
    publishCapturing,
    publishLive,
    resetSession,
    setActive,
    setError,
    setSession,
    setStatus,
  ]);

  startRef.current = start;

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
      if (lastAutoStartTokenRef.current === autoStartToken) {
        lastAutoStartTokenRef.current = null;
      }
    };
  }, [active, autoStart, autoStartToken, disabled]);

  const finish = useCallback(() => {
    if (!sessionOpenRef.current || finishingRef.current || didEndRef.current) {
      return;
    }
    finishingRef.current = true;
    setListening(false);
    publishCapturing(false);
    setFinishing(true);
    setError(null);
    clearTakeTimers();
    clearFinishingUiTimer();
    finishingUiTimerRef.current = setTimeout(() => {
      finishingUiTimerRef.current = null;
      if (finishingRef.current) {
        setStatus({
          phase: 'checking',
          message: DICTATION_MSG.finishingTranscription,
        });
      }
    }, FINISHING_UI_DELAY_MS);

    const session = sessionRef.current;
    sessionRef.current = null;

    if (session) {
      void session
        .stop()
        .then((text) => {
          clearFinishingUiTimer();
          if (text) {
            commitPhrase(text);
          }
          flushSession();
        })
        .catch(() => {
          clearFinishingUiTimer();
          flushSession();
        });
      return;
    }
    clearFinishingUiTimer();
    flushSession();
  }, [
    clearFinishingUiTimer,
    clearTakeTimers,
    commitPhrase,
    flushSession,
    publishCapturing,
    setError,
    setStatus,
  ]);

  finishRef.current = finish;

  const cancel = useCallback(() => {
    if (finishingRef.current || didEndRef.current) return;
    if (!sessionOpenRef.current && !startingRef.current) return;
    abortSessionQuietly();
    resetSession();
    setStatus(null);
    setError(null);
  }, [abortSessionQuietly, resetSession, setError, setStatus]);

  return {
    listening,
    capturing,
    starting,
    finishing,
    sessionOpen,
    start,
    finish,
    cancel,
    supported: isMoonshineDictationSupported(),
  };
}
