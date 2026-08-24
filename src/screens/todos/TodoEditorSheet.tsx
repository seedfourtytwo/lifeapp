import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { TODO_NOTE_MAX_LENGTH, TODO_TITLE_MAX_LENGTH, type Todo } from '../../protocol';

export interface TodoDraft {
  title: string;
  note: string | null;
  dueDate: string | null;
}

type Props = {
  visible: boolean;
  /** Null while adding; a todo while editing. */
  todo: Todo | null;
  onDismiss: () => void;
  onSave: (draft: TodoDraft) => Promise<void> | void;
  onDelete?: (todo: Todo) => Promise<void> | void;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A well-formed date string can still be nonsense — 2026-02-31 parses as March. */
function isRealDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default function TodoEditorSheet({ visible, todo, onDismiss, onSave, onDelete }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('todos');
  const { t: tCommon } = useTranslation('common');

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Reseed whenever the sheet opens, so a second todo never inherits the first
  // one's text.
  useEffect(() => {
    if (!visible) return;
    setTitle(todo?.title ?? '');
    setNote(todo?.note ?? '');
    setDueDate(todo?.dueDate ?? '');
    setShowErrors(false);
    setSaving(false);
  }, [visible, todo]);

  const trimmedTitle = title.trim();
  const trimmedDate = dueDate.trim();
  const dateInvalid = trimmedDate.length > 0 && !isRealDate(trimmedDate);
  const titleMissing = trimmedTitle.length === 0;

  const handleSave = async () => {
    if (titleMissing || dateInvalid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: trimmedTitle,
        note: note.trim().length > 0 ? note : null,
        dueDate: trimmedDate.length > 0 ? trimmedDate : null,
      });
      onDismiss();
    } catch (error) {
      Alert.alert(
        tCommon('alerts.couldNotSave'),
        error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      );
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!todo || !onDelete) return;
    Alert.alert(t('editor.deleteConfirmTitle'), t('editor.deleteConfirmBody'), [
      { text: t('editor.cancel'), style: 'cancel' },
      {
        text: t('editor.deleteConfirmAction'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await onDelete(todo);
            onDismiss();
          })();
        },
      },
    ]);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? () => {} : onDismiss}>
        <Dialog.Title>{todo ? t('editor.editTitle') : t('editor.newTitle')}</Dialog.Title>
        <Dialog.Content>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                mode="outlined"
                label={t('editor.titleLabel')}
                value={title}
                onChangeText={setTitle}
                maxLength={TODO_TITLE_MAX_LENGTH}
                autoFocus={!todo}
                returnKeyType="done"
              />
              {showErrors && titleMissing ? (
                <HelperText type="error" visible>
                  {t('editor.titleRequired')}
                </HelperText>
              ) : null}

              <View style={styles.deadlineRow}>
                <TextInput
                  mode="outlined"
                  style={styles.deadlineInput}
                  label={t('editor.deadlineLabel')}
                  placeholder={t('editor.deadlinePlaceholder')}
                  value={dueDate}
                  onChangeText={setDueDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
                {trimmedDate.length > 0 ? (
                  <Button compact onPress={() => setDueDate('')}>
                    {t('editor.deadlineClear')}
                  </Button>
                ) : null}
              </View>
              {showErrors && dateInvalid ? (
                <HelperText type="error" visible>
                  {t('editor.deadlineInvalid')}
                </HelperText>
              ) : null}

              <TextInput
                mode="outlined"
                style={styles.note}
                label={t('editor.noteLabel')}
                placeholder={t('editor.notePlaceholder')}
                value={note}
                onChangeText={setNote}
                maxLength={TODO_NOTE_MAX_LENGTH}
                multiline
                numberOfLines={4}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </Dialog.Content>
        <Dialog.Actions>
          {todo && onDelete ? (
            <Button
              textColor={theme.colors.error}
              disabled={saving}
              onPress={handleDelete}
              style={styles.deleteAction}
            >
              {t('editor.delete')}
            </Button>
          ) : null}
          <Button disabled={saving} onPress={onDismiss}>
            {t('editor.cancel')}
          </Button>
          <Button disabled={saving} onPress={() => void handleSave()}>
            {t('editor.save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  deadlineInput: {
    flex: 1,
  },
  note: {
    marginTop: 12,
  },
  deleteAction: {
    marginRight: 'auto',
  },
});
