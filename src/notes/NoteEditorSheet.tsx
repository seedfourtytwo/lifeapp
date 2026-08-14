import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Button,
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
import { useAppTheme } from '../hooks/useAppTheme';
import {
  NOTE_BODY_APPROACHING_REMAINING,
  NOTE_BODY_MAX_LENGTH,
  NOTE_BODY_URGENT_REMAINING,
} from './noteBodyLimits';
import { NoteEditorPreview } from './NoteEditorPreview';
import { appendTranscript } from '../utils/appendTranscript';
import { formatFullDate } from '../utils/dates';
import { playDictationCommitHaptic } from '../utils/habitHaptics';
import NoteDictationButton from '../components/dictation/NoteDictationButton';
import {
  livePreviewLength,
  type DictationLivePreview,
} from '../dictation/livePreview';
import type { DictationTakeLimitReason } from '../dictation/types';

export type NoteEditorSheetProps = {
  visible: boolean;
  date: string | null;
  /** Already localized ("Note" or "Journal"). */
  heading?: string;
  kind?: 'note' | 'journal';
  trackerName: string;
  initialBody: string;
  /** Changes when target or day changes — reseeds the draft. */
  sessionKey?: string | null;
  autoStartDictation?: boolean;
  saving?: boolean;
  onDismiss: () => void;
  onSave: (body: string) => void;
};

function clampNoteBody(text: string): string {
  return text.length <= NOTE_BODY_MAX_LENGTH
    ? text
    : text.slice(0, NOTE_BODY_MAX_LENGTH);
}

const COMMIT_FLASH_MS = 900;

/**
 * Shared editor for tracker notes and the daily journal.
 * Mic-first preview; keyboard only after Edit text.
 */
export default function NoteEditorSheet({
  visible,
  date,
  heading,
  kind = 'note',
  sessionKey = null,
  trackerName,
  initialBody,
  autoStartDictation = false,
  saving = false,
  onDismiss,
  onSave,
}: NoteEditorSheetProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('common');
  const { decorations: deco, isCartoon } = useAppTheme();
  const [draft, setDraft] = useState(() => clampNoteBody(initialBody));
  const [fieldSeed, setFieldSeed] = useState(() => clampNoteBody(initialBody));
  const [fieldEpoch, setFieldEpoch] = useState(0);
  const [textEditing, setTextEditing] = useState(false);
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [dictationHintTone, setDictationHintTone] = useState<'error' | 'notice'>('notice');
  const [capturedReview, setCapturedReview] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [dictationStatus, setDictationStatus] = useState<string | null>(null);
  const [dictationProgress, setDictationProgress] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [live, setLive] = useState<DictationLivePreview | null>(null);
  const [dictationSessionOpen, setDictationSessionOpen] = useState(false);
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationCapturing, setDictationCapturing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canUndoLastTake, setCanUndoLastTake] = useState(false);
  const seededSessionKeyRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const preTakeDraftRef = useRef('');
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepTakeLimitHintRef = useRef(false);
  const commitFlash = useRef(new Animated.Value(0)).current;
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

  const clearCopyFeedbackTimer = () => {
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  };

  const resetChrome = () => {
    setDictationHint(null);
    setDictationHintTone('notice');
    setCapturedReview(false);
    setDictationError(null);
    setDictationStatus(null);
    setDictationProgress(null);
    clearCopyFeedbackTimer();
    setCopyFeedback(null);
    setLive(null);
    setDictationSessionOpen(false);
    setDictationActive(false);
    setDictationCapturing(false);
    setMenuOpen(false);
    setCanUndoLastTake(false);
    preTakeDraftRef.current = '';
  };

  const pulseCommitFlash = () => {
    commitFlash.setValue(0);
    Animated.sequence([
      Animated.timing(commitFlash, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(commitFlash, {
        toValue: 0,
        duration: COMMIT_FLASH_MS,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        seededSessionKeyRef.current = null;
        setTextEditing(false);
        resetChrome();
      } else {
        setDictationHint(null);
        setCapturedReview(false);
        setDictationError(null);
        setDictationStatus(null);
        setDictationProgress(null);
      }
      return;
    }
    if (seededSessionKeyRef.current === sessionKey) return;
    remountField(initialBody);
    setTextEditing(false);
    resetChrome();
    seededSessionKeyRef.current = sessionKey;
    Keyboard.dismiss();
  }, [visible, date, sessionKey, initialBody]);

  useEffect(() => () => clearCopyFeedbackTimer(), []);

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = draft.trim().length > 0;
  const isDirty = draft.trim() !== initialBody.trim();
  const canSave = isDirty;
  const titleDate = date ? formatFullDate(date) : '';
  const listening = dictationSessionOpen;
  const showClear = listening ? hasDraftText : hasStoredNote || hasDraftText;
  const liveChars = listening ? livePreviewLength(live) : 0;
  const remaining = Math.max(0, NOTE_BODY_MAX_LENGTH - draft.length - liveChars);
  const noteRoomChars = Math.max(0, NOTE_BODY_MAX_LENGTH - draft.length);
  const nearLimit = remaining <= NOTE_BODY_APPROACHING_REMAINING;
  const urgentLimit = remaining <= NOTE_BODY_URGENT_REMAINING;
  const atLimit = remaining <= 0;

  const requestDismiss = () => {
    if (saving) return;
    if (capturedReview && isDirty) {
      Alert.alert(
        t('note.discardUnsavedTitle', { noun }),
        t('note.discardUnsavedBody'),
        [
          { text: t('note.cancel'), style: 'cancel' },
          {
            text: t('note.discardUnsavedAction'),
            style: 'destructive',
            onPress: onDismiss,
          },
        ],
      );
      return;
    }
    onDismiss();
  };

  const applyClearAll = () => {
    setMenuOpen(false);
    remountField('');
    preTakeDraftRef.current = '';
    setCanUndoLastTake(false);
    setCapturedReview(false);
    if (!listening) {
      setDictationHint(null);
      setLive(null);
    }
  };

  const applyClearLastTake = () => {
    setMenuOpen(false);
    remountField(preTakeDraftRef.current);
    setCanUndoLastTake(false);
    setCapturedReview(false);
    setDictationHint(null);
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
      if (!hasDraftText) return;
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
    setMenuOpen(false);
    if (saving) return;
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
    setCapturedReview(false);
    const body = draftRef.current;
    if (body.trim() === initialBody.trim()) return;
    onSave(body);
  };

  const enterTextEditing = () => {
    if (saving || listening) return;
    setMenuOpen(false);
    remountField(draftRef.current);
    setTextEditing(true);
  };

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
    Keyboard.dismiss();
    pulseCommitFlash();
    setCapturedReview(true);
    setCanUndoLastTake(preTakeDraftRef.current.trim().length > 0);
    void playDictationCommitHaptic();
  };

  const handleSessionChange = (open: boolean) => {
    setDictationSessionOpen(open);
    if (open) {
      preTakeDraftRef.current = draftRef.current;
      setCanUndoLastTake(false);
      keepTakeLimitHintRef.current = false;
      setCapturedReview(false);
      setDictationHint(null);
      setDictationError(null);
    }
    if (!open) setLive(null);
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

  const previewPlaceholder = isJournal
    ? t('note.previewPlaceholderJournal')
    : t('note.previewPlaceholderNote');

  const flashOpacity = commitFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });

  const showSave = !autoStartDictation || textEditing || isDirty;
  const blockDismiss = saving || dictationActive;
  const englishOnlyHint = i18n.language.toLowerCase().startsWith('fr');

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={blockDismiss ? undefined : requestDismiss}
        contentContainerStyle={[
          styles.modal,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
            ...(isCartoon && {
              borderWidth: deco.cardBorderWidth,
              borderColor: theme.colors.outline,
            }),
          },
        ]}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              active={visible}
              disabled={
                saving || !visible || (atLimit && !listening && !autoStartDictation)
              }
              noteRoomChars={noteRoomChars}
              autoStart={autoStartDictation && visible}
              autoStartToken={
                autoStartDictation && sessionKey ? `${sessionKey}:dictate` : null
              }
              onTranscript={handleTranscript}
              onLive={setLive}
              onSessionChange={handleSessionChange}
              onActiveChange={setDictationActive}
              onCapturingChange={setDictationCapturing}
              onFinished={autoStartDictation ? handleDictationFinished : undefined}
              onTakeWarning={handleTakeWarning}
              onTakeLimit={handleTakeLimit}
              onError={(message) => {
                setDictationError(message);
                if (message) {
                  setDictationStatus(null);
                  setDictationProgress(null);
                }
              }}
              onStatus={(status) => {
                setDictationStatus(status?.message ?? null);
                setDictationProgress(
                  status?.progress != null ? status.progress : null,
                );
              }}
            />
            {!listening && (showClear || hasDraftText || !textEditing) ? (
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    onPress={() => setMenuOpen(true)}
                    disabled={saving}
                    accessibilityLabel={t('note.moreActions')}
                    style={styles.headerIcon}
                  />
                }
              >
                {canUndoLastTake ? (
                  <Menu.Item
                    onPress={applyClearLastTake}
                    title={t('note.clearLastAction')}
                    leadingIcon="undo"
                    titleStyle={{ color: theme.colors.error }}
                  />
                ) : null}
                {showClear ? (
                  <Menu.Item
                    onPress={canUndoLastTake ? confirmClearAll : handleClear}
                    title={
                      canUndoLastTake
                        ? t('note.clearEntireAction', { noun })
                        : t('note.clear')
                    }
                    leadingIcon="delete-outline"
                    titleStyle={{ color: theme.colors.error }}
                  />
                ) : null}
                {hasDraftText ? (
                  <Menu.Item
                    onPress={() => void handleCopy()}
                    title={copyFeedback ?? t('note.copy')}
                    leadingIcon="content-copy"
                    disabled={saving}
                  />
                ) : null}
                {!textEditing ? (
                  <Menu.Item
                    onPress={enterTextEditing}
                    title={t('note.editText')}
                    leadingIcon="pencil-outline"
                    disabled={saving}
                  />
                ) : null}
              </Menu>
            ) : null}
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

          {textEditing ? (
            <TextInput
              key={`${sessionKey ?? 'closed'}-${fieldEpoch}`}
              mode="outlined"
              multiline
              numberOfLines={isJournal ? 8 : 6}
              defaultValue={fieldSeed}
              onChangeText={(next) => {
                setDictationHint(null);
                setCapturedReview(false);
                setDictationError(null);
                setDictationStatus(null);
                setDictationProgress(null);
                const clamped = clampNoteBody(next);
                draftRef.current = clamped;
                setDraft(clamped);
              }}
              style={[styles.input, isJournal && styles.journalInput]}
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
              capturing={dictationCapturing}
              capturedReview={capturedReview}
              placeholder={previewPlaceholder}
              flashOpacity={flashOpacity}
              saving={saving}
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

          {capturedReview ? (
            <Text
              variant="bodySmall"
              accessibilityLiveRegion="polite"
              accessibilityLabel={t('note.capturedReviewA11y')}
              style={{ color: theme.colors.primary, marginTop: 8 }}
            >
              {t('note.capturedReview')}
            </Text>
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

          <View style={styles.actions}>
            <View style={styles.actionsLeft}>
              {showClear ? (
                <Button
                  mode="text"
                  compact
                  textColor={theme.colors.error}
                  onPress={handleClear}
                  disabled={saving}
                  accessibilityLabel={
                    listening
                      ? t('note.clearExistingAction')
                      : canUndoLastTake
                        ? t('note.clearLastAccessible')
                        : t('note.clearAllAccessible', { noun })
                  }
                  style={styles.clearButton}
                >
                  {t('note.clear')}
                </Button>
              ) : null}
              {copyFeedback && !menuOpen ? (
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.primary, paddingHorizontal: 8 }}
                >
                  {copyFeedback}
                </Text>
              ) : null}
            </View>
            <View style={styles.actionsRight}>
              <Button mode="text" onPress={requestDismiss} disabled={saving || listening}>
                {autoStartDictation ? t('note.close') : t('note.cancel')}
              </Button>
              {showSave ? (
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving || !canSave || listening}
                >
                  {t('note.save')}
                </Button>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 16,
    padding: 16,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
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
    minHeight: 140,
    maxHeight: 280,
  },
  journalInput: {
    minHeight: 180,
    maxHeight: 320,
  },
  inputContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  limitBlock: {
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 0,
  },
  clearButton: {
    marginLeft: -8,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
