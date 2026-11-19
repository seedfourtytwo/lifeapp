import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import type { DailyJournal, JournalNotebook } from '../../protocol';
import { formatFullDate } from '../../utils/dates';
import { truncateNotePreview } from '../../utils/trackerHistoryFormat';
import { formatJournalDay } from './journalDates';
import NotebookChip from './NotebookChip';

export type TrackerNoteRow = {
  elementId: string;
  name: string;
  body: string;
};

type Props = {
  selectedDate: string;
  today: string;
  notebooks: JournalNotebook[];
  journals: DailyJournal[];
  /** The notebook being written in; the chips choose it. */
  notebookId: string | undefined;
  onChooseNotebook: (notebookId: string) => void;
  trackerNotes: TrackerNoteRow[];
  showTrackerNotes: boolean;
  /** Open one chapter that is already written. */
  onOpenChapter: (notebookId: string, date: string, entryId: string) => void;
  /** Write in this notebook for the day — by keyboard, or straight into dictation. */
  onWrite: (notebookId: string, date: string, opts: { dictate: boolean }) => void;
  onOpenTrackerNote: (row: TrackerNoteRow, date: string) => void;
  /** Leave a past day and come back to today. */
  onBackToToday: () => void;
};

/**
 * Where a day is written: the first thing on the Journal page, and today
 * unless a past day was opened from the list below.
 *
 * One tile. The notebooks are words you choose between, not a group each; what
 * is already written in the chosen one reads as prose above the field; and the
 * field is roomy, because writing is what the page is for. The field and the
 * mic open the note editor — typing and dictation both happen there.
 *
 * A notebook day is a stack of chapters, and each one is its own block — a day
 * with a morning entry and an argument at 11pm reads as two things. The block
 * is also the tap target for that chapter specifically.
 */
export default function JournalDayPanel({
  selectedDate,
  today,
  notebooks,
  journals,
  notebookId,
  onChooseNotebook,
  trackerNotes,
  showTrackerNotes,
  onOpenChapter,
  onWrite,
  onOpenTrackerNote,
  onBackToToday,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco } = useAppTheme();
  const notebook = notebooks.find((candidate) => candidate.id === notebookId) ?? notebooks[0];
  const entries = notebook
    ? journals.filter(
        (journal) => journal.date === selectedDate && journal.notebookId === notebook.id,
      )
    : [];
  const isToday = selectedDate === today;
  const title = isToday ? t('screen.today') : formatJournalDay(selectedDate, today);
  const spokenDate = formatFullDate(selectedDate);

  return (
    <Surface
      style={[styles.panel, { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg }]}
      elevation={0}
    >
      <View style={styles.titleRow}>
        <Text
          style={[typeScale.rowName, styles.title, { color: theme.colors.onSurface }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {isToday ? null : (
          <Button mode="text" compact onPress={onBackToToday} style={styles.backToToday}>
            {t('screen.today')}
          </Button>
        )}
      </View>

      {notebooks.length > 1 ? (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {notebooks.map((candidate) => (
            <NotebookChip
              key={candidate.id}
              ground="tile"
              label={candidate.name}
              notebook={candidate}
              selected={candidate.id === notebook?.id}
              onPress={() => onChooseNotebook(candidate.id)}
            />
          ))}
        </View>
      ) : null}

      {notebook
        ? entries.map((entry, position) => (
            <Pressable
              key={entry.id}
              onPress={() => onOpenChapter(notebook.id, selectedDate, entry.id)}
              accessibilityRole="button"
              accessibilityLabel={t('screen.openChapterA11y', {
                number: position + 1,
                name: notebook.name,
                date: spokenDate,
              })}
              style={({ pressed }) => [
                styles.chapter,
                pressed && {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: deco.radius.md,
                },
              ]}
            >
              {entries.length > 1 ? (
                <QuietText style={typeScale.caption}>
                  {t('screen.chapterHeading', { number: position + 1 })}
                </QuietText>
              ) : null}
              <Text style={[typeScale.reading, { color: theme.colors.onSurface }]} numberOfLines={8}>
                {truncateNotePreview(entry.body, 600)}
              </Text>
            </Pressable>
          ))
        : null}

      {notebook ? (
        <View
          style={[
            styles.field,
            { backgroundColor: theme.colors.background, borderRadius: deco.radius.md },
          ]}
        >
          <Pressable
            onPress={() => onWrite(notebook.id, selectedDate, { dictate: false })}
            accessibilityRole="button"
            accessibilityLabel={
              entries.length > 0
                ? t('screen.addChapterA11y', { name: notebook.name, date: spokenDate })
                : t('screen.addJournalForA11y', { date: spokenDate })
            }
            style={styles.fieldText}
          >
            <QuietText style={typeScale.body}>{t('screen.writeHint')}</QuietText>
          </Pressable>
          <IconButton
            icon="microphone-outline"
            size={24}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => onWrite(notebook.id, selectedDate, { dictate: true })}
            accessibilityLabel={t('screen.dictateA11y', { name: notebook.name })}
            style={styles.mic}
          />
        </View>
      ) : null}

      {showTrackerNotes && trackerNotes.length > 0 ? (
        <View style={styles.trackerBlock}>
          <QuietText style={typeScale.caption}>{t('screen.trackerNotesLabel')}</QuietText>
          {trackerNotes.map((row) => (
            <Pressable
              key={row.elementId}
              onPress={() => onOpenTrackerNote(row, selectedDate)}
              accessibilityRole="button"
              accessibilityLabel={t('screen.editNoteForA11y', { name: row.name })}
              style={({ pressed }) => [
                styles.trackerRow,
                pressed && {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: deco.radius.md,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="note-text-outline"
                size={22}
                color={theme.colors.onSurfaceVariant}
                style={styles.trackerIcon}
              />
              <View style={styles.trackerText}>
                <Text style={[typeScale.rowName, { color: theme.colors.onSurface }]}>{row.name}</Text>
                <QuietText style={typeScale.secondary} numberOfLines={2}>
                  {truncateNotePreview(row.body, 120)}
                </QuietText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    // The floor a text button needs, so the row does not jump when it appears.
    minHeight: 40,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  backToToday: {
    marginRight: -space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  /** Bled to the tile's padding so the pressed wash has room round the words. */
  chapter: {
    marginHorizontal: -space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    gap: space.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Roomy on purpose: three lines' worth, so it reads as a place to write.
    minHeight: 96,
  },
  fieldText: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  mic: {
    margin: space.xs,
  },
  trackerBlock: {
    paddingTop: space.xs,
    gap: space.xs,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
  },
  trackerIcon: {
    marginTop: space.xxs,
  },
  trackerText: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
});
