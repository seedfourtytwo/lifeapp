import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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
  clampNoteBody,
} from './noteBodyLimits';
import { NoteEditorPreview } from './NoteEditorPreview';
import { NoteEditorActions } from './NoteEditorActions';
import { NoteEditorHistoryBar } from './NoteEditorHistoryBar';
import { useNoteEditorPersist } from './useNoteEditorPersist';
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
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
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
  /** Sheet title — notebook or tracker name. */
  heading?: string;
  kind?: 'note' | 'journal';
  /** Optional glyph beside a journal title. */
  headingIcon?: TrackerIconId;
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

const DICTATION_WAKE_TAG = 'lifeapp-note-dictation';
/** Paper Menu overlay animation (~220ms) plus a beat so Alert/remount don't race it. */
const MENU_SETTLE_MS = 280;
const SHEET_MAX_WIDTH = 400;
const SHEET_GUTTER = 24;

function DictationKeepAwake() {
  useKeepAwake(DICTATION_WAKE_TAG);
  return null;
}

/**
 * Shared editor for tracker notes and the daily journal.
 * Mic-first preview; tap the body to type. Header X dismisses.
 * Done stops the mic; Save writes and closes when there is draft text.
 */
export default function NoteEditorSheet({
  visible,
  date,
  heading,
  kind = 'note',
  headingIcon,
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

  const persist = useNoteEditorPersist({
    visible,
    date,
    sessionKey,
    initialBody,
    onPersist,
  });

  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [dictationHintTone, setDictationHintTone] = useState<'error' | 'notice'>('notice');
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [dictationStatus, setDictationStatus] = useState<string | null>(null);
  const [dictationProgress, setDictationProgress] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [live, setLive] = useState<DictationLivePreview | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEpoch, setMenuEpoch] = useState(0);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const [shareAvailable, setShareAvailable] = useState(true);
  const chromeSeededKeyRef = useRef<string | null>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepTakeLimitHintRef = useRef(false);

  const isJournal = kind === 'journal';
  const noun = isJournal ? t('note.journalNoun') : t('note.noteNoun');
  const displayHeading =
    heading?.trim() ||
    trackerName.trim() ||
    (isJournal ? t('note.journalHeading') : t('note.noteHeading'));
  const titleIcon: TrackerIconId | undefined = isJournal
    ? (headingIcon ?? 'notebook-outline')
    : headingIcon;

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
        chromeSeededKeyRef.current = null;
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
    if (chromeSeededKeyRef.current === sessionKey) return;
    setSharing(false);
    sharingRef.current = false;
    resetChrome();
    chromeSeededKeyRef.current = sessionKey;
  }, [visible, date, sessionKey]);

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
    },
    [],
  );

  const handleTranscript = (text: string) => {
    const result = appendTranscript(persist.draftRef.current, text, NOTE_BODY_MAX_LENGTH);
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
    persist.remountField(result.text);
    persist.persistDraft(result.text);
    void playDictationCommitHaptic();
  };

  const handleSessionChange = (open: boolean) => {
    if (open) {
      keepTakeLimitHintRef.current = false;
      persist.setTextEditing(false);
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
    if (!persist.draftRef.current.trim()) {
      onDismiss();
    }
  };

  const dictation = useNoteDictationController({
    active: visible,
    disabled: saving || !visible,
    noteRoomChars: Math.max(0, NOTE_BODY_MAX_LENGTH - persist.draft.length),
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
  const historyLocked = saving || sharing || dictationBusy;

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = persist.draft.trim().length > 0;
  const titleDate = date ? formatFullDate(date) : '';
  const liveChars = listening ? livePreviewLength(live) : 0;
  const remaining = Math.max(0, NOTE_BODY_MAX_LENGTH - persist.draft.length - liveChars);
  const atLimit = remaining <= 0;
  const nearLimit = remaining <= NOTE_BODY_APPROACHING_REMAINING;
  const urgentLimit = remaining <= NOTE_BODY_URGENT_REMAINING;
  const showClear = listening
    ? hasDraftText || liveChars > 0
    : hasStoredNote || hasDraftText;
  const showMenu = showClear || hasDraftText;
  const showDone = dictation.starting || listening || dictation.finishing;
  const showSave = !showDone && hasDraftText;
  const shareStatus = noteShareStatus({
    draft: persist.draft,
    persisted: persist.persistedBody,
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
    !listening && !persist.textEditing
      ? splitAddedTake(initialBody, persist.draft)
      : null;
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
    persist.flushPendingPersist();
    onDismiss();
  };

  const applyClearAll = () => {
    if (listening) {
      dictation.cancel();
      setLive(null);
    }
    persist.clearAll();
    setDictationHint(null);
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
          onPress: applyClearAll,
        },
      ]);
      return;
    }
    if (!showClear) return;
    Alert.alert(t('note.clearConfirmTitle', { noun }), t('note.clearConfirmBody', { noun }), [
      { text: t('note.cancel'), style: 'cancel' },
      {
        text: t('note.clear'),
        style: 'destructive',
        onPress: applyClearAll,
      },
    ]);
  };

  const handleCopy = async () => {
    if (saving || sharing) return;
    const body = persist.draftRef.current;
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
    persist.flushPendingPersist();
    onSave(persist.draftRef.current);
  };

  const handleShare = async () => {
    if (sharingRef.current || saving || dictationBusy || !onShare) return;
    persist.flushPendingPersist();
    const body = persist.draftRef.current;
    if (!body.trim()) return;
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
    persist.remountField(persist.draftRef.current);
    persist.setTextEditing(true);
  };

  const leaveTextEditing = () => {
    Keyboard.dismiss();
    if (!persist.textEditing) return;
    persist.remountField(persist.draftRef.current);
    persist.flushPendingPersist();
    persist.setTextEditing(false);
  };

  const handleMicPress = () => {
    leaveTextEditing();
    void dictation.start();
  };

  const handleUndo = () => {
    if (historyLocked) return;
    persist.undoChunk();
  };

  const handleRedo = () => {
    if (historyLocked) return;
    persist.redoChunk();
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
        onDismiss={requestDismiss}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.headerTitleRow}>
                {titleIcon ? (
                  <TrackerIcon
                    name={titleIcon}
                    size={20}
                    color={theme.colors.onSurface}
                  />
                ) : null}
                <Text variant="titleMedium" numberOfLines={1} style={styles.headerTitle}>
                  {displayHeading}
                </Text>
              </View>
              {titleDate ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                >
                  {titleDate}
                </Text>
              ) : null}
            </View>
            {showShare ? (
              <IconButton
                icon="share-variant"
                onPress={() => void handleShare()}
                disabled={sharing}
                iconColor={shareTextColor}
                accessibilityLabel={`${t('note.shareA11y', { noun })}. ${shareStatusA11y}`}
                style={styles.headerIcon}
              />
            ) : null}
            {showMenu ? (
            <Menu
              key={menuEpoch}
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  onPress={() => setMenuOpen((open) => !open)}
                  disabled={saving || sharing}
                  accessibilityLabel={t('note.moreActions')}
                  style={styles.headerIcon}
                />
              }
            >
              {showClear ? (
                <Menu.Item
                  onPress={() => closeMenuThen(handleClear)}
                  title={t('note.clear')}
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
            ) : null}
            <IconButton
              icon="close"
              onPress={requestDismiss}
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

          {persist.textEditing && !dictationBusy ? (
            <TextInput
              key={`${sessionKey ?? 'closed'}-${persist.fieldEpoch}`}
              mode="outlined"
              multiline
              numberOfLines={isJournal ? 8 : 6}
              defaultValue={persist.fieldSeed}
              onChangeText={(next) => {
                setDictationHint(null);
                setDictationError(null);
                setDictationStatus(null);
                setDictationProgress(null);
                const clamped = clampNoteBody(next);
                persist.draftRef.current = clamped;
                persist.setDraft(clamped);
                persist.schedulePersist();
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
              draft={persist.draft}
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
                    count: (persist.draft.length + liveChars).toLocaleString(),
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
                  count: (persist.draft.length + liveChars).toLocaleString(),
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
            leading={
              <NoteEditorHistoryBar
                canUndo={persist.canUndo}
                canRedo={persist.canRedo}
                hidden={historyLocked}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            }
            mic={
              <NoteDictationButton
                listening={dictation.listening}
                capturing={dictation.capturing}
                starting={dictation.starting}
                finishing={dictation.finishing}
                sessionOpen={dictation.sessionOpen}
                disabled={micDisabled}
                onPress={handleMicPress}
              />
            }
            showDone={showDone}
            showSave={showSave}
            saving={saving}
            dictationStarting={dictation.starting}
            dictationFinishing={dictation.finishing}
            onDone={dictation.finish}
            onSave={handleSave}
          />
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flexGrow: 0,
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
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
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
