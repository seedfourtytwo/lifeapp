import { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { playDictationCommitHaptic } from '../utils/habitHaptics';
import { useNoteDictationController } from './useNoteDictationController';
import {
  NO_DICTATION_NOTICE,
  appendDictatedText,
  dictationNoticeReducer,
  type DictationJoin,
  type DictationNotice,
} from './dictationField';
import { livePreviewLength, type DictationLivePreview } from './livePreview';
import type { DictationTakeLimitReason } from './types';

export type DictationFieldStatus = {
  message: string;
  /** 0–100 while a model is downloading; null for a plain status line. */
  progress: number | null;
};

export type DictationFieldOptions = {
  /** The field's current text. The caller keeps owning it. */
  value: string;
  /** Handed the whole field again, with the finished take already appended. */
  onChangeText: (next: string) => void;
  /** The field's own cap — the same number its TextInput enforces. */
  maxLength: number;
  /** How a take joins the text already there. Defaults to `paragraph`. */
  join?: DictationJoin;
  /** False while the surface is closed: an open session is abandoned. */
  active?: boolean;
  /** True while the surface is busy (saving): no prep, no mic. */
  disabled?: boolean;
  /** Open the mic by itself when `autoStartToken` changes. */
  autoStart?: boolean;
  autoStartToken?: string | null;
  /** Shown when the field was too full to hold the whole take. */
  truncatedNotice?: string;
  onSessionChange?: (open: boolean) => void;
  onFinished?: () => void;
};

/** What a mic control needs to know to draw itself. */
export type DictationFieldPresence = {
  listening: boolean;
  capturing: boolean;
  starting: boolean;
  finishing: boolean;
  sessionOpen: boolean;
};

export type DictationField = DictationFieldPresence & {
  /** False on iOS, on web, and on Android phones without the engine. */
  supported: boolean;
  /** Mic prep through transcription — the field must not be dismissed. */
  busy: boolean;
  /** The take in progress, for callers that draw a live tail. */
  live: DictationLivePreview | null;
  /** Characters the live take is already claiming from the budget. */
  liveChars: number;
  notice: DictationNotice;
  error: string | null;
  status: DictationFieldStatus | null;
  micDisabled: boolean;
  start: () => void;
  /** Commit the current take. */
  finish: () => void;
  /** Drop the current take without committing it. */
  cancel: () => void;
  /** Retire the notice, error and status lines — e.g. the user typed. */
  clearNotices: () => void;
  /** `clearNotices`, plus forget the live take. */
  reset: () => void;
};

/**
 * Dictate into one text field.
 *
 * Everything between "there is a mic here" and "the words are in the field"
 * lives here: the engine session, the character budget, the take warning and
 * limit lines, permission and availability failures, and whether the mic can
 * be pressed at all. A caller supplies the text, a setter and a cap, then
 * draws whatever mic it likes from the returned state.
 *
 * The live take is *returned*, not rendered — a note draws it as an italic
 * tail inside a scrolling body, a single-line field just shows it in place,
 * and neither presentation belongs in here.
 */
export function useDictationField({
  value,
  onChangeText,
  maxLength,
  join = 'paragraph',
  active = true,
  disabled = false,
  autoStart = false,
  autoStartToken = null,
  truncatedNotice,
  onSessionChange,
  onFinished,
}: DictationFieldOptions): DictationField {
  const { t } = useTranslation('common');

  const [live, setLive] = useState<DictationLivePreview | null>(null);
  const [noticeState, setNoticeState] = useState(NO_DICTATION_NOTICE);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DictationFieldStatus | null>(null);

  // Read inside controller callbacks, which outlive the render that made them.
  const valueRef = useRef(value);
  valueRef.current = value;
  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;
  const joinRef = useRef(join);
  joinRef.current = join;
  const truncatedNoticeRef = useRef(truncatedNotice);
  truncatedNoticeRef.current = truncatedNotice;
  const onChangeTextRef = useRef(onChangeText);
  onChangeTextRef.current = onChangeText;
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  const tRef = useRef(t);
  tRef.current = t;

  const handleTranscript = useCallback((text: string) => {
    const result = appendDictatedText(
      valueRef.current,
      text,
      maxLengthRef.current,
      joinRef.current,
    );
    // The setter's state has not landed yet, so a take committed in the same
    // tick would otherwise append to the pre-take text.
    valueRef.current = result.text;
    setNoticeState((state) =>
      dictationNoticeReducer(state, {
        type: 'committed',
        truncatedText: result.truncated ? (truncatedNoticeRef.current ?? null) : null,
      }),
    );
    onChangeTextRef.current(result.text);
    void playDictationCommitHaptic();
  }, []);

  const handleSessionChange = useCallback((open: boolean) => {
    if (open) {
      // The mic and the soft keyboard fight over the same field.
      Keyboard.dismiss();
      setNoticeState((state) => dictationNoticeReducer(state, { type: 'sessionOpened' }));
      setError(null);
    } else {
      setLive(null);
    }
    onSessionChangeRef.current?.(open);
  }, []);

  const handleTakeWarning = useCallback(() => {
    setNoticeState((state) =>
      dictationNoticeReducer(state, {
        type: 'takeWarning',
        text: tRef.current('dictation.takeTimeWarning'),
      }),
    );
  }, []);

  const handleTakeLimit = useCallback((reason: DictationTakeLimitReason) => {
    setNoticeState((state) =>
      dictationNoticeReducer(state, {
        type: 'takeLimit',
        text: tRef.current(
          reason === 'duration' ? 'dictation.takeLimitDuration' : 'dictation.takeLimitCharacters',
        ),
      }),
    );
  }, []);

  const handleError = useCallback((message: string | null) => {
    setError(message);
    if (message) setStatus(null);
  }, []);

  const controller = useNoteDictationController({
    active,
    disabled: disabled || !active,
    noteRoomChars: Math.max(0, maxLength - value.length),
    autoStart: autoStart && active,
    autoStartToken,
    onTranscript: handleTranscript,
    onLive: setLive,
    onSessionChange: handleSessionChange,
    onFinished,
    onTakeWarning: handleTakeWarning,
    onTakeLimit: handleTakeLimit,
    onError: handleError,
    onStatus: (next) =>
      setStatus(next ? { message: next.message, progress: next.progress ?? null } : null),
  });

  const clearNotices = useCallback(() => {
    setNoticeState(NO_DICTATION_NOTICE);
    setError(null);
    setStatus(null);
  }, []);

  const reset = useCallback(() => {
    clearNotices();
    setLive(null);
  }, [clearNotices]);

  const start = useCallback(() => {
    void controller.start();
  }, [controller]);

  const cancel = useCallback(() => {
    controller.cancel();
    setLive(null);
  }, [controller]);

  const liveChars = controller.sessionOpen ? livePreviewLength(live) : 0;
  const atLimit = value.length + liveChars >= maxLength;

  return useMemo(
    () => ({
      listening: controller.listening,
      capturing: controller.capturing,
      starting: controller.starting,
      finishing: controller.finishing,
      sessionOpen: controller.sessionOpen,
      supported: controller.supported,
      busy: controller.starting || controller.sessionOpen || controller.finishing,
      live,
      liveChars,
      notice: noticeState.notice,
      error,
      status,
      // A full field still needs its mic mid-take — that is how the take ends.
      // An auto-start was asked for before the field was read, so let it run.
      micDisabled: disabled || !active || (atLimit && !controller.sessionOpen && !autoStart),
      start,
      finish: controller.finish,
      cancel,
      clearNotices,
      reset,
    }),
    [
      active,
      atLimit,
      autoStart,
      cancel,
      clearNotices,
      controller.capturing,
      controller.finish,
      controller.finishing,
      controller.listening,
      controller.sessionOpen,
      controller.starting,
      controller.supported,
      disabled,
      error,
      live,
      liveChars,
      noticeState.notice,
      reset,
      start,
      status,
    ],
  );
}
