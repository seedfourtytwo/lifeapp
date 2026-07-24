import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
} from '../notes/noteBodyLimits';
import { appendTranscript } from '../utils/appendTranscript';
import { formatFullDate } from '../utils/dates';
import { playDictationCommitHaptic } from '../utils/habitHaptics';
import DayNoteDictationButton from './DayNoteDictationButton';
import { DictationStageGlow } from './dictation/DictationPresence';

export interface DayNoteEditorSheetProps {
  visible: boolean;
  date: string | null;
  /** Primary sheet title — already localized ("Note" or "Journal"). */
  heading?: string;
  /** Drives copy that differs between notes and journals. */
  kind?: 'note' | 'journal';
  trackerName: string;
  initialBody: string;
  /** Stable id for draft seeding — changes when target or day changes. */
  sessionKey?: string | null;
  /** Start mic dictation once when the sheet opens. */
  autoStartDictation?: boolean;
  saving?: boolean;
  onDismiss: () => void;
  onSave: (body: string) => void;
}

/** Keep editor draft within the protocol max (corrupt / oversized imports). */
function clampNoteBody(text: string): string {
  return text.length <= NOTE_BODY_MAX_LENGTH
    ? text
    : text.slice(0, NOTE_BODY_MAX_LENGTH);
}

const COMMIT_FLASH_MS = 900;

export default function DayNoteEditorSheet({
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
}: DayNoteEditorSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { decorations: deco, isCartoon } = useAppTheme();
  /** Draft tracked for dirty/limit UI — not fed back as `value` (IME-safe). */
  const [draft, setDraft] = useState(() => clampNoteBody(initialBody));
  /** Seed text for uncontrolled remounts (open / clear / dictation). */
  const [fieldSeed, setFieldSeed] = useState(() => clampNoteBody(initialBody));
  const [fieldEpoch, setFieldEpoch] = useState(0);
  /** Mic-first: full TextInput only after Edit text / tap preview. */
  const [textEditing, setTextEditing] = useState(false);
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  /** Live Echo — wet ink while the engine is still hypothesizing. */
  const [liveEcho, setLiveEcho] = useState<string | null>(null);
  const [dictationSessionOpen, setDictationSessionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const seededSessionKeyRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Seed when the sheet opens for a target+day — not when the parent refreshes mid-edit.
  // Uncontrolled TextInput (defaultValue + remount): controlled `value` fights phone IME.
  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        seededSessionKeyRef.current = null;
        setTextEditing(false);
        clearCopyFeedbackTimer();
        setCopyFeedback(null);
        setLiveEcho(null);
        setDictationSessionOpen(false);
        setMenuOpen(false);
      }
      setDictationHint(null);
      setDictationError(null);
      return;
    }
    if (seededSessionKeyRef.current === sessionKey) return;
    remountField(initialBody);
    setTextEditing(false);
    setDictationHint(null);
    setDictationError(null);
    clearCopyFeedbackTimer();
    setCopyFeedback(null);
    setLiveEcho(null);
    setDictationSessionOpen(false);
    setMenuOpen(false);
    seededSessionKeyRef.current = sessionKey;
    // Mic-first: don't pop the keyboard on open — only when the user edits text.
    Keyboard.dismiss();
  }, [visible, date, sessionKey, initialBody]);

  useEffect(() => () => clearCopyFeedbackTimer(), []);

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = draft.trim().length > 0;
  /** Compare trimmed text — trailing spaces aren't a meaningful edit (save trims anyway). */
  const isDirty = draft.trim() !== initialBody.trim();
  const showClear = hasStoredNote || hasDraftText;
  const canSave = isDirty;
  const titleDate = date ? formatFullDate(date) : '';
  const remaining = Math.max(0, NOTE_BODY_MAX_LENGTH - draft.length);
  const nearLimit = remaining <= NOTE_BODY_APPROACHING_REMAINING;
  const urgentLimit = remaining <= NOTE_BODY_URGENT_REMAINING;
  const atLimit = remaining <= 0;
  const listening = dictationSessionOpen;

  const requestDismiss = () => {
    if (saving) return;
    onDismiss();
  };

  const handleClear = () => {
    setMenuOpen(false);
    setDictationHint(null);
    setDictationError(null);
    clearCopyFeedbackTimer();
    setCopyFeedback(null);
    setLiveEcho(null);
    if (hasStoredNote) {
      onSave('');
      return;
    }
    remountField('');
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
    const prev = draftRef.current;
    const result = appendTranscript(prev, text, NOTE_BODY_MAX_LENGTH);
    if (result.truncated) {
      setDictationHint(
        isJournal
          ? t('note.dictationHintTruncatedJournal')
          : t('note.dictationHintTruncatedNote'),
      );
    }
    // Remount so dictation text appears without driving a controlled `value`.
    remountField(result.text);
    Keyboard.dismiss();
    pulseCommitFlash();
    void playDictationCommitHaptic();
  };

  const handleSessionChange = (open: boolean) => {
    setDictationSessionOpen(open);
    if (!open) setLiveEcho(null);
  };

  /** Quick Home capture: Done finishes speech, then saves and closes when dirty. */
  const handleDictationFinished = () => {
    if (!autoStartDictation || saving) return;
    const body = draftRef.current;
    if (body.trim() !== initialBody.trim()) {
      onSave(body);
      return;
    }
    onDismiss();
  };

  const previewPlaceholder = isJournal
    ? t('note.previewPlaceholderJournal')
    : t('note.previewPlaceholderNote');

  const flashOpacity = commitFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });

  const showSave = !autoStartDictation || textEditing || isDirty;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={saving ? undefined : requestDismiss}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            <DayNoteDictationButton
              active={visible}
              // Quick-capture autoStart must still arm when already at max (append truncates).
              disabled={saving || !visible || (atLimit && !autoStartDictation)}
              autoStart={autoStartDictation && visible}
              autoStartToken={
                autoStartDictation && sessionKey ? `${sessionKey}:dictate` : null
              }
              onTranscript={handleTranscript}
              onInterim={setLiveEcho}
              onSessionChange={handleSessionChange}
              onFinished={autoStartDictation ? handleDictationFinished : undefined}
              onError={setDictationError}
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
                {showClear ? (
                  <Menu.Item
                    onPress={handleClear}
                    title={t('note.clear')}
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
              disabled={saving}
              accessibilityLabel={
                isJournal ? t('note.closeJournalAccessible') : t('note.closeNoteAccessible')
              }
              style={styles.headerIcon}
            />
          </View>

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
                setDictationError(null);
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
              // Form autofill off — keep normal keyboard spelling suggestions.
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              spellCheck
            />
          ) : (
            <DictationStageGlow
              active={listening}
              color={theme.dark ? '#8B7BB8' : '#5B4B8A'}
              borderRadius={10}
              style={[
                styles.preview,
                isJournal && styles.journalPreview,
                {
                  borderColor: theme.colors.outline,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Pressable
                onPress={enterTextEditing}
                disabled={saving || listening}
                accessibilityRole="button"
                accessibilityLabel={
                  hasDraftText
                    ? t('note.editNoteAccessible', { noun })
                    : t('note.editNoteEmptyAccessible', { noun })
                }
                accessibilityHint={t('note.editNoteHint')}
                style={[
                  styles.previewPress,
                  isJournal && styles.journalPreviewPress,
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: theme.colors.onSurface,
                      opacity: flashOpacity,
                      borderRadius: 3,
                    },
                  ]}
                />
                {hasDraftText || liveEcho ? (
                  <View>
                    {hasDraftText ? (
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                        {draft}
                      </Text>
                    ) : null}
                    {liveEcho ? (
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: theme.colors.onSurfaceVariant,
                          fontStyle: 'italic',
                          marginTop: hasDraftText ? 8 : 0,
                          opacity: 0.75,
                        }}
                        accessibilityLiveRegion="polite"
                        accessibilityLabel={t('note.liveEchoA11y', { text: liveEcho })}
                      >
                        {liveEcho}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {previewPlaceholder}
                  </Text>
                )}
              </Pressable>
            </DictationStageGlow>
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
                    count: draft.length.toLocaleString(),
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
                  count: draft.length.toLocaleString(),
                  max: NOTE_BODY_MAX_LENGTH.toLocaleString(),
                })}
              </Text>
            </View>
          ) : null}

          {dictationHint ? (
            <Text
              variant="bodySmall"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.error, marginTop: 4 }}
            >
              {dictationHint}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <View style={styles.actionsLeft}>
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
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  headerIcon: {
    margin: 0,
  },
  preview: {
    minHeight: 140,
    maxHeight: 280,
  },
  journalPreview: {
    minHeight: 180,
    maxHeight: 320,
  },
  previewPress: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 140,
  },
  journalPreviewPress: {
    minHeight: 180,
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
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
