import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const seededSessionKeyRef = useRef<string | null>(null);
  const limitAlertShownRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const isJournal = heading === 'Journal';
  const noun = isJournal ? 'journal' : 'note';

  const remountField = (text: string) => {
    setFieldSeed(text);
    setDraft(text);
    setFieldEpoch((n) => n + 1);
  };

  // Seed draft when the sheet opens for a target+day — not when parent refreshes mid-edit.
  // Uncontrolled TextInput (defaultValue + remount) — controlled `value` fights phone IME.
  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        seededSessionKeyRef.current = null;
        limitAlertShownRef.current = false;
      }
      setDictationHint(null);
      setDictationError(null);
      return;
    }
    if (seededSessionKeyRef.current === sessionKey) return;
    remountField(initialBody);
    setDictationHint(null);
    setDictationError(null);
    limitAlertShownRef.current = initialBody.length >= NOTE_BODY_MAX_LENGTH;
    seededSessionKeyRef.current = sessionKey;
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
    if (hasStoredNote) {
      onSave('');
      return;
    }
    remountField('');
  };

  const handleSave = () => {
    if (!canSave || saving) return;
    onSave(draft);
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
  };

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
                {trackerName}
                {titleDate ? ` · ${titleDate}` : ''}
              </Text>
            </View>
            <DayNoteDictationButton
              compact
              active={visible}
              disabled={saving || !visible || atLimit}
              onTranscript={handleTranscript}
              onError={setDictationError}
            />
            <IconButton
              icon="close"
              onPress={requestDismiss}
              disabled={saving}
              accessibilityLabel={isJournal ? 'Close journal' : 'Close note'}
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

          <TextInput
            key={`${sessionKey ?? 'closed'}-${fieldEpoch}`}
            mode="outlined"
            multiline
            numberOfLines={isJournal ? 8 : 6}
            defaultValue={fieldSeed}
            onChangeText={(next) => {
              setDictationHint(null);
              notifyIfReachedLimit(next.length, draftRef.current.length);
              setDraft(next);
            }}
            style={[styles.input, isJournal && styles.journalInput]}
            contentStyle={styles.inputContent}
            disabled={saving}
            autoFocus={visible}
            maxLength={NOTE_BODY_MAX_LENGTH}
            autoCorrect
            autoCapitalize="sentences"
            // Form autofill off — keep normal keyboard spelling suggestions.
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            spellCheck
          />
          {nearLimit ? (
            <Text
              variant="labelSmall"
              accessibilityLiveRegion="polite"
              style={{
                color: atLimit ? theme.colors.error : theme.colors.onSurfaceVariant,
                marginTop: 4,
                textAlign: 'right',
              }}
            >
              {atLimit
                ? `Character limit reached (${NOTE_BODY_MAX_LENGTH.toLocaleString()})`
                : `${remaining.toLocaleString()} characters left`}
            </Text>
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
            ) : (
              <View />
            )}
            <View style={styles.actionsRight}>
              <Button mode="text" onPress={requestDismiss} disabled={saving}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving || !canSave}
              >
                Save
              </Button>
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  input: {
    minHeight: 140,
  },
  journalInput: {
    minHeight: 180,
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
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
