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
import { DAY_NOTE_BODY_MAX_LENGTH } from '../protocol';
import { appendTranscript } from '../utils/appendTranscript';
import { formatFullDate } from '../utils/dates';
import DayNoteDictationButton from './DayNoteDictationButton';

export interface DayNoteEditorSheetProps {
  visible: boolean;
  date: string | null;
  trackerName: string;
  initialBody: string;
  saving?: boolean;
  onDismiss: () => void;
  onSave: (body: string) => void;
}

export default function DayNoteEditorSheet({
  visible,
  date,
  trackerName,
  initialBody,
  saving = false,
  onDismiss,
  onSave,
}: DayNoteEditorSheetProps) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const [body, setBody] = useState(initialBody);
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const seededForDateRef = useRef<string | null>(null);

  // Seed draft when the sheet opens for a day — not when parent refreshes notes mid-edit.
  useEffect(() => {
    if (!visible || !date) {
      seededForDateRef.current = null;
      setDictationHint(null);
      return;
    }
    if (seededForDateRef.current === date) return;
    setBody(initialBody);
    setDictationHint(null);
    seededForDateRef.current = date;
  }, [visible, date, initialBody]);

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = body.trim().length > 0;
  /** Compare trimmed text — trailing spaces aren't a meaningful edit (save trims anyway). */
  const isDirty = body.trim() !== initialBody.trim();
  const showClear = hasStoredNote || hasDraftText;
  const canSave = isDirty;
  const titleDate = date ? formatFullDate(date) : '';
  const nearLimit = body.length >= DAY_NOTE_BODY_MAX_LENGTH - 100;

  const requestDismiss = () => {
    if (saving) return;
    if (!isDirty) {
      onDismiss();
      return;
    }
    Alert.alert('Discard note?', 'You have unsaved changes.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDismiss },
    ]);
  };

  const handleClear = () => {
    if (hasStoredNote) {
      Alert.alert('Delete note?', 'This removes the saved note for this day.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onSave('') },
      ]);
      return;
    }
    if (isDirty) {
      Alert.alert('Clear draft?', 'This discards what you typed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setBody('') },
      ]);
      return;
    }
    setBody('');
  };

  const handleSave = () => {
    if (!canSave || saving) return;
    // Saving an emptied note deletes it — confirm like Clear.
    if (body.trim().length === 0 && hasStoredNote) {
      Alert.alert('Delete note?', 'This removes the saved note for this day.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onSave('') },
      ]);
      return;
    }
    onSave(body);
  };

  const handleTranscript = (text: string) => {
    setBody((prev) => {
      const result = appendTranscript(prev, text);
      if (result.truncated) {
        setDictationHint('Note is at the character limit — some dictation was cut.');
      }
      return result.text;
    });
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
              <Text variant="titleMedium">Note</Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
              >
                {trackerName}
                {titleDate ? ` · ${titleDate}` : ''}
              </Text>
            </View>
            <IconButton
              icon="close"
              onPress={requestDismiss}
              disabled={saving}
              accessibilityLabel="Close note"
            />
          </View>

          <TextInput
            mode="outlined"
            multiline
            numberOfLines={6}
            value={body}
            onChangeText={(next) => {
              setDictationHint(null);
              setBody(next);
            }}
            placeholder="What mattered about this day?"
            style={styles.input}
            disabled={saving}
            autoFocus={visible}
            maxLength={DAY_NOTE_BODY_MAX_LENGTH}
          />
          {nearLimit ? (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'right' }}
            >
              {body.length}/{DAY_NOTE_BODY_MAX_LENGTH}
            </Text>
          ) : null}

          <View style={styles.dictation}>
            <DayNoteDictationButton
              active={visible}
              disabled={saving || !visible}
              onTranscript={handleTranscript}
            />
            {dictationHint ? (
              <Text
                variant="bodySmall"
                accessibilityLiveRegion="polite"
                style={{ color: theme.colors.error, marginTop: 4 }}
              >
                {dictationHint}
              </Text>
            ) : null}
          </View>

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
  dictation: {
    marginTop: 8,
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
