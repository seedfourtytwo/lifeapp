import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ChoiceChip from '../../components/ChoiceChip';
import QuietText from '../../components/QuietText';
import { EditorSheet, FilledField } from '../../components/sheet';
import { TODO_NOTE_MAX_LENGTH, TODO_TITLE_MAX_LENGTH, type Todo } from '../../protocol';
import { dictationMicIcon } from '../../dictation/dictationField';
import { livePreviewText } from '../../dictation/livePreview';
import { useDictationField } from '../../dictation/useDictationField';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { dueChipDates, matchDueChip, type DueChip } from './dueChips';

export interface TodoDraft {
  title: string;
  note: string | null;
  dueDate: string | null;
}

type Props = {
  visible: boolean;
  /** The app's calendar date; the deadline chips count from it. */
  today: string;
  /** Null while adding; a todo while editing. */
  todo: Todo | null;
  onDismiss: () => void;
  onSave: (draft: TodoDraft) => Promise<void> | void;
  /** Deletes at once — the list offers Undo, so there is no confirm step. */
  onDelete?: (todo: Todo) => void;
};

const QUICK_CHIPS = ['none', 'today', 'tomorrow', 'weekend', 'nextWeek'] as const;
const CHIP_LABEL_KEY: Record<DueChip, string> = {
  none: 'editor.deadlineNone',
  today: 'editor.dueToday',
  tomorrow: 'editor.dueTomorrow',
  weekend: 'editor.dueWeekend',
  nextWeek: 'editor.dueNextWeek',
  custom: 'editor.dueOther',
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A well-formed date string can still be nonsense — 2026-02-31 parses as March. */
function isRealDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default function TodoEditorSheet({
  visible,
  today,
  todo,
  onDismiss,
  onSave,
  onDelete,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('todos');
  const { t: tCommon } = useTranslation('common');

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  /** "Other day" was picked, or the saved deadline matches no chip. */
  const [customDate, setCustomDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The note is the only field here worth speaking into — a title is a few
   * words you are already holding the phone to type, and a deadline is eight
   * digits. Dictation is Android-only and English-only, so on anything else
   * `supported` is false and the field is exactly what it was.
   */
  const dictation = useDictationField({
    value: note,
    onChangeText: setNote,
    maxLength: TODO_NOTE_MAX_LENGTH,
    active: visible,
    disabled: saving,
    truncatedNotice: t('editor.noteDictationTruncated'),
  });
  const mic = dictationMicIcon(dictation);
  const heard = dictation.sessionOpen ? livePreviewText(dictation.live) : '';
  const shownNote = heard ? (note.trimEnd() ? `${note.trimEnd()}\n${heard}` : heard) : note;
  const dictationLine = dictation.error
    ? { text: dictation.error, tone: 'error' as const }
    : (dictation.status && { text: dictation.status.message, tone: 'notice' as const }) ||
      dictation.notice;
  // A take in flight owns the sheet: closing or saving now would throw the
  // words away between the mic stopping and the transcript arriving.
  const locked = saving || dictation.busy;

  // Reseed whenever the sheet opens, so a second todo never inherits the
  // first one's text.
  useEffect(() => {
    if (!visible) return;
    setTitle(todo?.title ?? '');
    setNote(todo?.note ?? '');
    setDueDate(todo?.dueDate ?? '');
    setCustomDate(matchDueChip(todo?.dueDate ?? null, today) === 'custom');
    setError(null);
    setSaving(false);
    // `today` only matters at the moment the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, todo]);

  const chipDates = dueChipDates(today);
  const selectedChip: DueChip = customDate ? 'custom' : matchDueChip(dueDate || null, today);
  const pickChip = (chip: DueChip) => {
    setError(null);
    if (chip === 'custom') {
      setCustomDate(true);
      return;
    }
    setCustomDate(false);
    setDueDate(chip === 'none' ? '' : chipDates[chip]);
  };

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
    onDelete(todo);
    onDismiss();
  };

  return (
    <EditorSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!locked}
      title={todo ? t('editor.editTitle') : t('editor.newTitle')}
      primaryAction={{ label: t('editor.save'), onPress: () => void handleSave(), disabled: locked }}
      destructiveAction={
        todo && onDelete
          ? { accessibilityLabel: t('editor.delete'), onPress: handleDelete, disabled: locked }
          : undefined
      }
    >
      <FilledField
        placeholder={t('editor.titleLabel')}
        value={title}
        onChangeText={(next) => {
          setTitle(next);
          setError(null);
        }}
        maxLength={TODO_TITLE_MAX_LENGTH}
        autoFocus={!todo}
        returnKeyType="done"
      />

      <View style={styles.due}>
        <QuietText style={typeScale.caption}>{t('editor.deadlineLabel')}</QuietText>
        <View
          style={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('editor.deadlineLabel')}
        >
          {[...QUICK_CHIPS, 'custom' as const].map((chip) => (
            <ChoiceChip
              key={chip}
              label={t(CHIP_LABEL_KEY[chip])}
              selected={selectedChip === chip}
              onPress={() => pickChip(chip)}
            />
          ))}
        </View>
        {customDate ? (
          <FilledField
            accessibilityLabel={t('editor.deadlineLabel')}
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
          />
        ) : null}
      </View>

      <FilledField
        placeholder={t('editor.noteLabel')}
        value={shownNote}
        onChangeText={(next) => {
          dictation.clearNotices();
          setNote(next);
        }}
        maxLength={TODO_NOTE_MAX_LENGTH}
        multiline
        editable={!dictation.sessionOpen}
        rightAccessory={
          dictation.supported ? (
            <IconButton
              icon={mic.icon}
              size={22}
              iconColor={theme.colors.onSurfaceVariant}
              disabled={mic.disabled}
              onPress={mic.action === 'finish' ? dictation.finish : dictation.start}
              accessibilityLabel={
                mic.action === 'finish'
                  ? tCommon('dictation.finishA11y')
                  : tCommon('dictation.startA11y')
              }
            />
          ) : undefined
        }
      />

      {dictationLine ? (
        dictationLine.tone === 'error' ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typeScale.caption, { color: theme.colors.error }]}
          >
            {dictationLine.text}
          </Text>
        ) : (
          <QuietText style={typeScale.caption} accessibilityLiveRegion="polite">
            {dictationLine.text}
          </QuietText>
        )
      ) : null}

      {error ? (
        <Text style={[typeScale.caption, { color: theme.colors.error }]}>{error}</Text>
      ) : null}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  due: {
    gap: space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
