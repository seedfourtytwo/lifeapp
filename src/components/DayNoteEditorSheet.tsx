import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  IconButton,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { NOTE_BODY_MAX_LENGTH } from '../notes/types';
import { appendTranscript } from '../utils/appendTranscript';
import { formatFullDate } from '../utils/dates';
import DayNoteDictationButton from './DayNoteDictationButton';

export interface DayNoteEditorSheetProps {
  visible: boolean;
  date: string | null;
  /** Primary sheet title — "Note" or "Journal". */
  heading?: string;
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

export default function DayNoteEditorSheet({
  visible,
  date,
  heading = 'Note',
  sessionKey = null,
  trackerName,
  initialBody,
  autoStartDictation = false,
  saving = false,
  onDismiss,
  onSave,
}: DayNoteEditorSheetProps) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  /** Draft tracked for dirty/limit UI — not fed back as `value` (IME-safe). */
  const [draft, setDraft] = useState(initialBody);
  /** Seed text for uncontrolled remounts (open / clear / dictation). */
  const [fieldSeed, setFieldSeed] = useState(initialBody);
  const [fieldEpoch, setFieldEpoch] = useState(0);
  /** Mic-first: full TextInput only after Edit text / tap preview. */
  const [textEditing, setTextEditing] = useState(false);
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const seededSessionKeyRef = useRef<string | null>(null);
  const limitAlertShownRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const isJournal = heading === 'Journal';
  const noun = isJournal ? 'journal' : 'note';

  const remountField = (text: string) => {
    draftRef.current = text;
    setFieldSeed(text);
    setDraft(text);
    setFieldEpoch((n) => n + 1);
  };

  // Seed when the sheet opens for a target+day — not when the parent refreshes mid-edit.
  // Uncontrolled TextInput (defaultValue + remount): controlled `value` fights phone IME.
  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        seededSessionKeyRef.current = null;
        limitAlertShownRef.current = false;
        setTextEditing(false);
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
    limitAlertShownRef.current = initialBody.length >= NOTE_BODY_MAX_LENGTH;
    seededSessionKeyRef.current = sessionKey;
    // Mic-first: don't pop the keyboard on open — only when the user edits text.
    Keyboard.dismiss();
  }, [visible, date, sessionKey, initialBody]);

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = draft.trim().length > 0;
  /** Compare trimmed text — trailing spaces aren't a meaningful edit (save trims anyway). */
  const isDirty = draft.trim() !== initialBody.trim();
  const showClear = hasStoredNote || hasDraftText;
  const canSave = isDirty;
  const titleDate = date ? formatFullDate(date) : '';
  const remaining = NOTE_BODY_MAX_LENGTH - draft.length;
  const nearLimit = remaining <= 100;
  const atLimit = remaining <= 0;

  const notifyIfReachedLimit = (nextLength: number, previousLength: number) => {
    if (nextLength < NOTE_BODY_MAX_LENGTH) {
      if (nextLength < NOTE_BODY_MAX_LENGTH - 50) {
        limitAlertShownRef.current = false;
      }
      return;
    }
    if (previousLength >= NOTE_BODY_MAX_LENGTH || limitAlertShownRef.current) return;
    limitAlertShownRef.current = true;
    Alert.alert(
      'Character limit reached',
      `This ${noun} can be at most ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters. Shorten some text to keep writing.`,
    );
  };

  const requestDismiss = () => {
    if (saving) return;
    onDismiss();
  };

  const handleClear = () => {
    setDictationHint(null);
    setDictationError(null);
    if (hasStoredNote) {
      onSave('');
      return;
    }
    remountField('');
  };

  const handleSave = () => {
    if (saving) return;
    const body = draftRef.current;
    if (body.trim() === initialBody.trim()) return;
    onSave(body);
  };

  const enterTextEditing = () => {
    if (saving) return;
    remountField(draftRef.current);
    setTextEditing(true);
  };

  const handleTranscript = (text: string) => {
    const prev = draftRef.current;
    const result = appendTranscript(prev, text);
    if (result.truncated) {
      setDictationHint(
        isJournal
          ? 'Journal is at the character limit — some dictation was cut.'
          : 'Note is at the character limit — some dictation was cut.',
      );
      notifyIfReachedLimit(result.text.length, prev.length);
    }
    // Remount so dictation text appears without driving a controlled `value`.
    remountField(result.text);
    Keyboard.dismiss();
  };

  /** Quick Home capture: Done finishes speech, saves, and closes. */
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
    ? "Tap the mic to dictate today's journal"
    : 'Tap the mic to dictate a note';

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
              <Text variant="titleMedium">{heading}</Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
              >
                {[trackerName, titleDate].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <DayNoteDictationButton
              active={visible}
              disabled={saving || !visible || (atLimit && !autoStartDictation)}
              autoStart={autoStartDictation && visible}
              autoStartToken={
                autoStartDictation && sessionKey ? `${sessionKey}:dictate` : null
              }
              onTranscript={handleTranscript}
              onFinished={autoStartDictation ? handleDictationFinished : undefined}
              onError={setDictationError}
            />
            <IconButton
              icon="close"
              onPress={requestDismiss}
              disabled={saving}
              accessibilityLabel={isJournal ? 'Close journal' : 'Close note'}
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
                notifyIfReachedLimit(next.length, draftRef.current.length);
                draftRef.current = next;
                setDraft(next);
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
            <Pressable
              onPress={enterTextEditing}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={
                hasDraftText
                  ? `Edit ${noun} text`
                  : `Edit ${noun} — currently empty`
              }
              accessibilityHint="Opens the keyboard to type or correct text"
              style={[
                styles.preview,
                isJournal && styles.journalPreview,
                {
                  borderColor: theme.colors.outline,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Text
                variant="bodyMedium"
                style={{
                  color: hasDraftText
                    ? theme.colors.onSurface
                    : theme.colors.onSurfaceVariant,
                }}
              >
                {hasDraftText ? draft : previewPlaceholder}
              </Text>
            </Pressable>
          )}

          <Text
            variant="labelSmall"
            accessibilityLiveRegion={nearLimit ? 'polite' : 'none'}
            accessibilityLabel={`${draft.length.toLocaleString()} of ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters${
              atLimit ? ', limit reached' : nearLimit ? ', approaching limit' : ''
            }`}
            style={{
              color: atLimit
                ? theme.colors.error
                : nearLimit
                  ? theme.colors.onSurfaceVariant
                  : theme.colors.outline,
              marginTop: 6,
              textAlign: 'right',
              fontVariant: ['tabular-nums'],
              opacity: atLimit ? 1 : nearLimit ? 0.9 : 0.7,
            }}
          >
            {`${draft.length.toLocaleString()} / ${NOTE_BODY_MAX_LENGTH.toLocaleString()}`}
          </Text>

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
              {showClear ? (
                <Button
                  mode="text"
                  textColor={theme.colors.error}
                  onPress={handleClear}
                  disabled={saving}
                  compact
                >
                  Clear
                </Button>
              ) : null}
              {!textEditing ? (
                <Button
                  mode="text"
                  onPress={enterTextEditing}
                  disabled={saving}
                  compact
                >
                  Edit text
                </Button>
              ) : null}
            </View>
            <View style={styles.actionsRight}>
              <Button mode="text" onPress={requestDismiss} disabled={saving}>
                {autoStartDictation ? 'Close' : 'Cancel'}
              </Button>
              {!autoStartDictation || textEditing || isDirty ? (
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving || !canSave}
                >
                  Save
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
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  journalPreview: {
    minHeight: 180,
    maxHeight: 320,
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
