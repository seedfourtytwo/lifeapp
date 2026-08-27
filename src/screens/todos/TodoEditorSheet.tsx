import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';
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
  const [error, setError] = useState<string | null>(null);

  // Reseed whenever the sheet opens, so a second todo never inherits the
  // first one's text.
  useEffect(() => {
    if (!visible) return;
    setTitle(todo?.title ?? '');
    setNote(todo?.note ?? '');
    setDueDate(todo?.dueDate ?? '');
    setError(null);
    setSaving(false);
  }, [visible, todo]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedDate = dueDate.trim();

    if (!trimmedTitle) {
      setError(t('editor.titleRequired'));
      return;
    }
    if (trimmedDate.length > 0 && !isRealDate(trimmedDate)) {
      setError(t('editor.deadlineInvalid'));
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
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : tCommon('errors.somethingWentWrong'),
      );
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!todo || !onDelete) return;
    Alert.alert(t('editor.deleteConfirmTitle'), t('editor.deleteConfirmBody'), [
      { text: tCommon('actions.cancel'), style: 'cancel' },
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
        <Dialog.Content style={styles.content}>
          <TextInput
            mode="outlined"
            label={t('editor.titleLabel')}
            value={title}
            onChangeText={(next) => {
              setTitle(next);
              setError(null);
            }}
            maxLength={TODO_TITLE_MAX_LENGTH}
            autoFocus={!todo}
            returnKeyType="done"
          />

          <TextInput
            mode="outlined"
            label={t('editor.deadlineLabel')}
            placeholder={t('editor.deadlinePlaceholder')}
            value={dueDate}
            onChangeText={(next) => {
              setDueDate(next);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            right={
              dueDate.length > 0 ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => setDueDate('')}
                  accessibilityLabel={t('editor.deadlineClear')}
                />
              ) : undefined
            }
          />

          <TextInput
            mode="outlined"
            style={styles.note}
            label={t('editor.noteLabel')}
            value={note}
            onChangeText={setNote}
            maxLength={TODO_NOTE_MAX_LENGTH}
            multiline
          />

          {error ? (
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              {error}
            </Text>
          ) : null}

          {todo && onDelete ? (
            <View style={styles.deleteRow}>
              <Button
                compact
                icon="trash-can-outline"
                textColor={theme.colors.error}
                disabled={saving}
                onPress={handleDelete}
              >
                {t('editor.delete')}
              </Button>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button disabled={saving} onPress={onDismiss}>
            {tCommon('actions.cancel')}
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
  content: {
    gap: 12,
  },
  /** Capped so a long note cannot push the actions off a short screen. */
  note: {
    maxHeight: 140,
  },
  deleteRow: {
    flexDirection: 'row',
  },
});
