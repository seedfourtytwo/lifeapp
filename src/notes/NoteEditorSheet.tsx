import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import {
  IconButton,
  Menu,
  Modal,
  Portal,
  ProgressBar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  NOTE_BODY_APPROACHING_REMAINING,
  NOTE_BODY_MAX_LENGTH,
  NOTE_BODY_URGENT_REMAINING,
} from './noteBodyLimits';
import { NoteEditorPreview } from './NoteEditorPreview';
import { NoteEditorActions } from './NoteEditorActions';
import { appendTranscript, splitAddedTake } from '../utils/appendTranscript';
import { formatFullDate } from '../utils/dates';
import { playDictationCommitHaptic } from '../utils/habitHaptics';
import NoteDictationButton from '../components/dictation/NoteDictationButton';
import { useNoteDictationController } from '../dictation/useNoteDictationController';
import {
  livePreviewLength,
  type DictationLivePreview,
} from '../dictation/livePreview';
import type { DictationTakeLimitReason } from '../dictation/types';
import {
  canShowNoteShare,
  NOTE_SHARE_STALE_DARK,
  NOTE_SHARE_STALE_LIGHT,
  noteShareActionColor,
  noteShareStatus,
} from './noteShareStatus';

export type NoteEditorSheetProps = {
  visible: boolean;
  date: string | null;
  /** Already localized ("Note" or "Journal"). */
  heading?: string;
  kind?: 'note' | 'journal';
  trackerName: string;
  initialBody: string;
  /** Last successfully shared body fingerprint, if any. */
  shareFingerprint?: string | null;
  /** Changes when target or day changes — reseeds the draft. */
  sessionKey?: string | null;
  autoStartDictation?: boolean;
  saving?: boolean;
  onDismiss: () => void;
  /** Checkpoint to SQLite without closing. */
  onPersist?: (body: string) => void;
  onSave: (body: string) => void;
  onShare?: (body: string) => void | Promise<void>;
};

function clampNoteBody(text: string): string {
  return text.length <= NOTE_BODY_MAX_LENGTH
    ? text
    : text.slice(0, NOTE_BODY_MAX_LENGTH);
}

const DICTATION_WAKE_TAG = 'lifeapp-note-dictation';
/** Paper Menu overlay animation (~220ms) plus a beat so Alert/remount don't race it. */
const MENU_SETTLE_MS = 280;
const SHEET_MAX_WIDTH = 400;
const SHEET_GUTTER = 24;
const PERSIST_DEBOUNCE_MS = 1600;

function DictationKeepAwake() {
  useKeepAwake(DICTATION_WAKE_TAG);
  return null;
}

/**
 * Shared editor for tracker notes and the daily journal.
 * Mic-first preview; tap the body to type. Header X dismisses.
 * Thumb-zone Done morphs into Save.
 */
export default function NoteEditorSheet({
  visible,
  date,
  heading,
  kind = 'note',
  sessionKey = null,
  trackerName,
  initialBody,
  shareFingerprint = null,
  autoStartDictation = false,
  saving = false,
  onDismiss,
  onPersist,
  onSave,
  onShare,
}: NoteEditorSheetProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('common');
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(SHEET_MAX_WIDTH, Math.max(280, windowWidth - SHEET_GUTTER * 2));
  const previewMaxHeight = Math.round(Math.min(windowHeight * 0.52, windowHeight - 320));
  const previewMinHeight = Math.round(Math.min(windowHeight * 0.28, previewMaxHeight));
  const [draft, setDraft] = useState(() => clampNoteBody(initialBody));
  const [fieldSeed, setFieldSeed] = useState(() => clampNoteBody(initialBody));
  const [fieldEpoch, setFieldEpoch] = useState(0);
  const [textEditing, setTextEditing] = useState(false);
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [dictationHintTone, setDictationHintTone] = useState<'error' | 'notice'>('notice');
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [dictationStatus, setDictationStatus] = useState<string | null>(null);
  const [dictationProgress, setDictationProgress] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [live, setLive] = useState<DictationLivePreview | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEpoch, setMenuEpoch] = useState(0);
  const [canUndoLastTake, setCanUndoLastTake] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const [shareAvailable, setShareAvailable] = useState(true);
  const [persistedBody, setPersistedBody] = useState(() => clampNoteBody(initialBody));
  const seededSessionKeyRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const preTakeDraftRef = useRef('');
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepTakeLimitHintRef = useRef(false);
  const lastPersistedRef = useRef(initialBody);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const isJournal = kind === 'journal';
  const noun = isJournal ? t('note.journalNoun') : t('note.noteNoun');
  const displayHeading = heading ?? (isJournal ? t('note.journalHeading') : t('note.noteHeading'));

  const remountField = (text: string) => {
    const next = clampNoteBody(text);
    draftRef.current = next;
    setFieldSeed(next);
    setDraft(next);
    setFieldEpoch((n) => n + 1);
  };

  const persistDraft = (body: string) => {
    if (body === lastPersistedRef.current) return;
    lastPersistedRef.current = body;
    setPersistedBody(body);
    onPersistRef.current?.(body);
  };

  const schedulePersist = () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistDraft(draftRef.current);
    }, PERSIST_DEBOUNCE_MS);
  };

  const clearCopyFeedbackTimer = () => {
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  };

  const resetChrome = () => {
    setDictationHint(null);
    setDictationHintTone('notice');
    setDictationError(null);
    setDictationStatus(null);
    setDictationProgress(null);
    clearCopyFeedbackTimer();
    setCopyFeedback(null);
    setLive(null);
    setMenuOpen(false);
    setCanUndoLastTake(false);
    preTakeDraftRef.current = '';
  };

  const closeMenuThen = (action: () => void) => {
    setMenuOpen(false);
    if (menuActionTimerRef.current) {
      clearTimeout(menuActionTimerRef.current);
    }
    menuActionTimerRef.current = setTimeout(() => {
      menuActionTimerRef.current = null;
      setMenuEpoch((n) => n + 1);
      action();
    }, MENU_SETTLE_MS);
  };

  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        seededSessionKeyRef.current = null;
        setTextEditing(false);
        setSharing(false);
        sharingRef.current = false;
        resetChrome();
      } else {
        setDictationHint(null);
        setDictationError(null);
        setDictationStatus(null);
        setDictationProgress(null);
      }
      return;
    }
    if (seededSessionKeyRef.current === sessionKey) return;
    remountField(initialBody);
    lastPersistedRef.current = initialBody;
    setPersistedBody(clampNoteBody(initialBody));
    setSharing(false);
    sharingRef.current = false;
    setTextEditing(false);
    resetChrome();
    seededSessionKeyRef.current = sessionKey;
    Keyboard.dismiss();
  }, [visible, date, sessionKey, initialBody]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void Sharing.isAvailableAsync().then((ok) => {
      if (!cancelled) setShareAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(
    () => () => {
      clearCopyFeedbackTimer();
      if (menuActionTimerRef.current) {
        clearTimeout(menuActionTimerRef.current);
        menuActionTimerRef.current = null;
      }
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    },
    [],
  );

  const handleTranscript = (text: string) => {
    const result = appendTranscript(draftRef.current, text, NOTE_BODY_MAX_LENGTH);
    if (result.truncated) {
      keepTakeLimitHintRef.current = false;
      setDictationHintTone('error');
      setDictationHint(
        isJournal
          ? t('note.dictationHintTruncatedJournal')
          : t('note.dictationHintTruncatedNote'),
      );
    } else if (!keepTakeLimitHintRef.current) {
      setDictationHint(null);
    }
    remountField(result.text);
    persistDraft(result.text);
    setCanUndoLastTake(preTakeDraftRef.current.trim().length > 0);
    void playDictationCommitHaptic();
  };

  const handleSessionChange = (open: boolean) => {
    if (open) {
      preTakeDraftRef.current = draftRef.current;
      setCanUndoLastTake(false);
      keepTakeLimitHintRef.current = false;
      setTextEditing(false);
      Keyboard.dismiss();
      setDictationHint(null);
      setDictationError(null);
    } else {
      setLive(null);
    }
  };

  const handleTakeWarning = () => {
    keepTakeLimitHintRef.current = false;
    setDictationHintTone('notice');
    setDictationHint(t('dictation.takeTimeWarning'));
  };

  const handleTakeLimit = (reason: DictationTakeLimitReason) => {
    keepTakeLimitHintRef.current = true;
    setDictationHintTone('notice');
    setDictationHint(
      reason === 'duration'
        ? t('dictation.takeLimitDuration')
        : t('dictation.takeLimitCharacters'),
    );
  };

  const handleDictationFinished = () => {
    if (!autoStartDictation || saving) return;
    if (!draftRef.current.trim()) {
      onDismiss();
    }
  };

  const dictation = useNoteDictationController({
    active: visible,
    disabled: saving || !visible,
    noteRoomChars: Math.max(0, NOTE_BODY_MAX_LENGTH - draft.length),
    autoStart: autoStartDictation && visible,
    autoStartToken:
      autoStartDictation && sessionKey ? `${sessionKey}:dictate` : null,
    onTranscript: handleTranscript,
    onLive: setLive,
    onSessionChange: handleSessionChange,
    onFinished: handleDictationFinished,
    onTakeWarning: handleTakeWarning,
    onTakeLimit: handleTakeLimit,
    onError: (message) => {
      setDictationError(message);
      if (message) {
        setDictationStatus(null);
        setDictationProgress(null);
      }
    },
    onStatus: (status) => {
      setDictationStatus(status?.message ?? null);
      setDictationProgress(status?.progress != null ? status.progress : null);
    },
  });

  const listening = dictation.sessionOpen;
  const dictationBusy = dictation.starting || dictation.sessionOpen || dictation.finishing;

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = draft.trim().length > 0;
  const isDirty = draft.trim() !== initialBody.trim();
  const titleDate = date ? formatFullDate(date) : '';
  const liveChars = listening ? livePreviewLength(live) : 0;
  const remaining = Math.max(0, NOTE_BODY_MAX_LENGTH - draft.length - liveChars);
  const atLimit = remaining <= 0;
  const nearLimit = remaining <= NOTE_BODY_APPROACHING_REMAINING;
  const urgentLimit = remaining <= NOTE_BODY_URGENT_REMAINING;
  const showClear = listening
    ? hasDraftText || liveChars > 0
    : hasStoredNote || hasDraftText;
  const showMenu = showClear || hasDraftText;
  const showDone = listening || dictation.finishing;
  const showSave = !showDone && isDirty;
  const shareStatus = noteShareStatus({
    draft,
    persisted: persistedBody,
    lastSharedFingerprint: shareFingerprint,
  });
  const showShare =
    canShowNoteShare({
      hasDraftText,
      dictationBusy,
      shareAvailable: shareAvailable && onShare != null,
      saving,
    }) || sharing;
  const reviewHighlight =
    !listening && !textEditing ? splitAddedTake(initialBody, draft) : null;
  const blockDismiss = saving || dictationBusy || sharing;
  const englishOnlyHint = i18n.language.toLowerCase().startsWith('fr');
  const shareStatusA11y =
    shareStatus === 'current'
      ? t('note.shareStatusCurrentA11y')
      : shareStatus === 'stale'
        ? t('note.shareStatusStaleA11y')
        : t('note.shareStatusNeverA11y');
  const shareTextColor = noteShareActionColor(shareStatus, {
    current: theme.colors.primary,
    stale: isCartoon
      ? theme.colors.secondary
      : theme.dark
        ? NOTE_SHARE_STALE_DARK
        : NOTE_SHARE_STALE_LIGHT,
    idle: theme.colors.onSurface,
  });

  const requestDismiss = () => {
    if (saving) return;
    if (isDirty) {
      Alert.alert(
        t('note.discardUnsavedTitle', { noun }),
        t('note.discardUnsavedBody'),
        [
          { text: t('note.cancel'), style: 'cancel' },
          {
            text: t('note.discardUnsavedAction'),
            style: 'destructive',
            onPress: () => {
              lastPersistedRef.current = initialBody;
              setPersistedBody(initialBody);
              onPersistRef.current?.(initialBody);
              onDismiss();
            },
          },
        ],
      );
      return;
    }
    onDismiss();
  };

  const applyClearAll = () => {
    remountField('');
    preTakeDraftRef.current = '';
    setCanUndoLastTake(false);
    persistDraft('');
    if (!listening) {
      setDictationHint(null);
      setLive(null);
    }
  };

  const applyClearLastTake = () => {
    remountField(preTakeDraftRef.current);
    setCanUndoLastTake(false);
    setDictationHint(null);
    persistDraft(preTakeDraftRef.current);
  };

  const applyClearWhileListening = () => {
    remountField('');
    preTakeDraftRef.current = '';
    setCanUndoLastTake(false);
    setDictationHint(null);
    setLive(null);
    persistDraft('');
    dictation.cancel();
    void dictation.start();
  };

  const confirmClearAll = () => {
    Alert.alert(t('note.clearConfirmTitle', { noun }), t('note.clearConfirmBody', { noun }), [
      { text: t('note.cancel'), style: 'cancel' },
      {
        text: t('note.clear'),
        style: 'destructive',
        onPress: applyClearAll,
      },
    ]);
  };

  const handleClear = () => {
    if (saving) return;
    if (listening) {
      if (!hasDraftText && liveChars <= 0) return;
      Alert.alert(t('note.clearExistingTitle'), t('note.clearExistingBody', { noun }), [
        { text: t('note.cancel'), style: 'cancel' },
        {
          text: t('note.clearExistingAction'),
          style: 'destructive',
          onPress: applyClearWhileListening,
        },
      ]);
      return;
    }
    if (!showClear) return;
    if (canUndoLastTake) {
      Alert.alert(t('note.clearChooseTitle', { noun }), t('note.clearChooseBody'), [
        { text: t('note.cancel'), style: 'cancel' },
        { text: t('note.clearLastAction'), onPress: applyClearLastTake },
        {
          text: t('note.clearEntireAction', { noun }),
          style: 'destructive',
          onPress: applyClearAll,
        },
      ]);
      return;
    }
    confirmClearAll();
  };

  const handleCopy = async () => {
    if (saving || sharing) return;
    const body = draftRef.current;
    if (!body.trim()) return;
    try {
      await Clipboard.setStringAsync(body);
      clearCopyFeedbackTimer();
      setCopyFeedback(t('note.copied'));
      copyFeedbackTimerRef.current = setTimeout(() => {
        setCopyFeedback(null);
        copyFeedbackTimerRef.current = null;
      }, 2000);
    } catch {
      Alert.alert(t('note.couldNotCopyTitle'), t('note.couldNotCopyBody'));
    }
  };

  const handleSave = () => {
    if (saving) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const body = draftRef.current;
    lastPersistedRef.current = body;
    setPersistedBody(body);
    onSave(body);
  };

  const handleShare = async () => {
    if (sharingRef.current || saving || dictationBusy || !onShare) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const body = draftRef.current;
    if (!body.trim()) return;
    persistDraft(body);
    sharingRef.current = true;
    setSharing(true);
    try {
      await onShare(body);
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  };

  const enterTextEditing = () => {
    if (saving || sharing || dictationBusy) return;
    remountField(draftRef.current);
    setTextEditing(true);
  };

  const leaveTextEditing = () => {
    Keyboard.dismiss();
    if (!textEditing) return;
    remountField(draftRef.current);
    setTextEditing(false);
  };

  const handleMicPress = () => {
    leaveTextEditing();
    void dictation.start();
  };

  const previewPlaceholder = isJournal
    ? t('note.previewPlaceholderJournal')
    : t('note.previewPlaceholderNote');

  const micDisabled =
    saving ||
    sharing ||
    !visible ||
    (atLimit && !listening && !autoStartDictation);

  return (
    <Portal>
      {visible && dictationBusy ? <DictationKeepAwake /> : null}
      <Modal
        visible={visible}
        onDismiss={blockDismiss ? undefined : requestDismiss}
        style={styles.modalWrap}
        contentContainerStyle={[
          styles.modal,
          {
            width: sheetWidth,
            maxHeight: windowHeight - insets.top - insets.bottom - 32,
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
            ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
            ...(isCartoon && {
              borderWidth: deco.cardBorderWidth,
              borderColor: theme.colors.outline,
            }),
          },
        ]}
      >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="titleMedium">{displayHeading}</Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
              >
                {[trackerName, titleDate].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <NoteDictationButton
              listening={dictation.listening}
              capturing={dictation.capturing}
              starting={dictation.starting}
              finishing={dictation.finishing}
              sessionOpen={dictation.sessionOpen}
              disabled={micDisabled}
              onPress={handleMicPress}
            />
            <Menu
              key={menuEpoch}
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  onPress={() => {
                    if (!showMenu) return;
                    setMenuOpen((open) => !open);
                  }}
                  disabled={saving || sharing || !showMenu}
                  accessibilityLabel={t('note.moreActions')}
                  style={styles.headerIcon}
                />
              }
            >
              {canUndoLastTake && !listening ? (
                <Menu.Item
                  onPress={() => closeMenuThen(applyClearLastTake)}
                  title={t('note.clearLastAction')}
                  leadingIcon="undo"
                  titleStyle={{ color: theme.colors.error }}
                />
              ) : null}
              {showClear ? (
                <Menu.Item
                  onPress={() =>
                    closeMenuThen(
                      canUndoLastTake && !listening ? confirmClearAll : handleClear,
                    )
                  }
                  title={
                    canUndoLastTake && !listening
                      ? t('note.clearEntireAction', { noun })
                      : t('note.clear')
                  }
                  leadingIcon="delete-outline"
                  titleStyle={{ color: theme.colors.error }}
                />
              ) : null}
              {hasDraftText && !listening ? (
                <Menu.Item
                  onPress={() => closeMenuThen(() => void handleCopy())}
                  title={copyFeedback ?? t('note.copy')}
                  leadingIcon="content-copy"
                  disabled={saving}
                />
              ) : null}
            </Menu>
            <IconButton
              icon="close"
              onPress={requestDismiss}
              disabled={blockDismiss}
              accessibilityLabel={
                isJournal ? t('note.closeJournalAccessible') : t('note.closeNoteAccessible')
              }
              style={styles.headerIcon}
            />
          </View>

          {englishOnlyHint ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
            >
              {t('dictation.englishOnlyHint')}
            </Text>
          ) : null}

          {dictationStatus ? (
            <View style={styles.dictationStatusBlock}>
              <Text
                variant="bodySmall"
                accessibilityLiveRegion="polite"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {dictationStatus}
              </Text>
              {dictationProgress != null ? (
                <ProgressBar
                  progress={dictationProgress / 100}
                  style={styles.dictationProgress}
                  accessibilityLabel={dictationStatus}
                />
              ) : null}
            </View>
          ) : null}

          {dictationError ? (
            <Text
              variant="bodySmall"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.error, marginBottom: 4 }}
            >
              {dictationError}
            </Text>
          ) : null}

          {textEditing && !dictationBusy ? (
            <TextInput
              key={`${sessionKey ?? 'closed'}-${fieldEpoch}`}
              mode="outlined"
              multiline
              numberOfLines={isJournal ? 8 : 6}
              defaultValue={fieldSeed}
              onChangeText={(next) => {
                setDictationHint(null);
                setDictationError(null);
                setDictationStatus(null);
                setDictationProgress(null);
                const clamped = clampNoteBody(next);
                draftRef.current = clamped;
                setDraft(clamped);
                schedulePersist();
              }}
              style={[
                styles.input,
                { minHeight: previewMinHeight, maxHeight: previewMaxHeight },
              ]}
              contentStyle={styles.inputContent}
              disabled={saving}
              autoFocus
              maxLength={NOTE_BODY_MAX_LENGTH}
              autoCorrect
              autoCapitalize="sentences"
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              spellCheck
            />
          ) : (
            <NoteEditorPreview
              noun={noun}
              isJournal={isJournal}
              draft={draft}
              live={live}
              listening={listening}
              capturing={dictation.capturing}
              reviewHighlight={reviewHighlight}
              placeholder={previewPlaceholder}
              minHeight={previewMinHeight}
              maxHeight={previewMaxHeight}
              saving={saving}
              editLocked={dictationBusy}
              onEdit={enterTextEditing}
            />
          )}

          {nearLimit ? (
            <View style={styles.limitBlock}>
              <Text
                variant="bodySmall"
                accessibilityLiveRegion="polite"
                style={{
                  color: atLimit || urgentLimit ? theme.colors.error : theme.colors.onSurfaceVariant,
                  fontWeight: urgentLimit || atLimit ? '600' : '400',
                }}
              >
                {atLimit
                  ? t('note.limitBannerFull', { noun })
                  : urgentLimit
                    ? t('note.limitBannerUrgent', { count: remaining })
                    : t('note.limitBannerApproaching', { count: remaining })}
              </Text>
              <Text
                variant="labelSmall"
                accessibilityLiveRegion="polite"
                accessibilityLabel={t(
                  atLimit
                    ? 'note.characterCountLimitReachedA11y'
                    : 'note.characterCountApproachingLimitA11y',
                  {
                    count: (draft.length + liveChars).toLocaleString(),
                    max: NOTE_BODY_MAX_LENGTH.toLocaleString(),
                  },
                )}
                style={{
                  color: atLimit || urgentLimit ? theme.colors.error : theme.colors.onSurfaceVariant,
                  fontVariant: ['tabular-nums'],
                  marginTop: 4,
                  textAlign: 'right',
                }}
              >
                {t('note.characterCount', {
                  count: (draft.length + liveChars).toLocaleString(),
                  max: NOTE_BODY_MAX_LENGTH.toLocaleString(),
                })}
              </Text>
            </View>
          ) : null}

          {dictationHint ? (
            <Text
              variant="bodySmall"
              accessibilityLiveRegion="polite"
              style={{
                color:
                  dictationHintTone === 'error'
                    ? theme.colors.error
                    : theme.colors.onSurfaceVariant,
                marginTop: 4,
              }}
            >
              {dictationHint}
            </Text>
          ) : null}

          {copyFeedback ? (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.primary, marginTop: 8 }}
            >
              {copyFeedback}
            </Text>
          ) : null}

          <NoteEditorActions
            noun={noun}
            showShare={showShare}
            showDone={showDone}
            showSave={showSave}
            sharing={sharing}
            saving={saving}
            isDirty={isDirty}
            shareTextColor={shareTextColor}
            shareStatusA11y={shareStatusA11y}
            dictationStarting={dictation.starting}
            dictationFinishing={dictation.finishing}
            onShare={() => void handleShare()}
            onDone={dictation.finish}
            onSave={handleSave}
          />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalWrap: {
    justifyContent: 'center',
  },
  modal: {
    alignSelf: 'center',
    marginVertical: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      default: {},
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'visible',
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  headerIcon: {
    margin: 0,
  },
  dictationStatusBlock: {
    marginBottom: 8,
    gap: 6,
  },
  dictationProgress: {
    height: 4,
    borderRadius: 2,
  },
  input: {
    minHeight: 144,
    maxHeight: 280,
  },
  inputContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  limitBlock: {
    marginTop: 8,
  },
});
