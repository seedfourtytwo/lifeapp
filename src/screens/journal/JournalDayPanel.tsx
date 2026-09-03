import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { TrackerIcon } from '../../components/trackerIcons/TrackerIcon';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import type { DailyJournal, JournalNotebook } from '../../protocol';
import { formatFullDate } from '../../utils/dates';
import { truncateNotePreview } from '../../utils/trackerHistoryFormat';

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
  trackerNotes: TrackerNoteRow[];
  showTrackerNotes: boolean;
  filter: 'all' | 'trackers' | string;
  /** Open one chapter; no `entryId` means the day's first (or a blank one). */
  onOpenJournal: (notebookId: string, date: string, entryId?: string) => void;
  /** Start a fresh chapter in this notebook for the day. */
  onAddChapter: (notebookId: string, date: string) => void;
  onOpenTrackerNote: (row: TrackerNoteRow, date: string) => void;
};

/**
 * Selected-day writing surface: previews first, tap to open the editor.
 *
 * A notebook day is a stack of chapters, and each one is its own block — a day
 * with a morning entry and an argument at 11pm reads as two things, which is
 * the whole reason they are two rows rather than one body with a blank line in
 * it. The block is also the tap target for that chapter specifically.
 */
export default function JournalDayPanel({
  selectedDate,
  today,
  notebooks,
  journals,
  trackerNotes,
  showTrackerNotes,
  filter,
  onOpenJournal,
  onAddChapter,
  onOpenTrackerNote,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco, isCartoon } = useAppTheme();
  const entriesForSelected = journals.filter((journal) => journal.date === selectedDate);
  const grouped = notebooks
    .map((notebook) => ({
      notebook,
      entries: entriesForSelected.filter((entry) => entry.notebookId === notebook.id),
    }))
    .filter((group) => {
      if (filter === 'trackers') return false;
      if (filter !== 'all' && group.notebook.id !== filter) return false;
      return true;
    });
  const defaultNotebookId = notebooks[0]?.id;
  const title = selectedDate === today ? t('screen.today') : formatFullDate(selectedDate);
  const showEmptyTrackerNotes = showTrackerNotes && trackerNotes.length === 0 && filter === 'trackers';

  return (
    <Surface
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          borderRadius: deco.radius.md,
          borderWidth: deco.cardBorderWidth,
        },
      ]}
      elevation={0}
    >
      <Text variant="titleMedium">{title}</Text>

      {grouped.map(({ notebook, entries }, index) => (
        <View
          key={notebook.id}
          style={[
            styles.group,
            index > 0 && styles.groupAfterFirst,
          ]}
        >
          <View style={styles.groupHeader}>
            <View
              style={[
                styles.well,
                {
                  backgroundColor: `${notebook.color}33`,
                  borderRadius: isCartoon ? deco.radius.sm : 12,
                },
              ]}
            >
              {notebook.icon ? (
                <TrackerIcon name={notebook.icon} size={22} color={notebook.color} />
              ) : (
                <MaterialCommunityIcons
                  name="notebook-outline"
                  size={22}
                  color={notebook.color}
                />
              )}
            </View>
            <Text variant="labelLarge" style={styles.groupName}>
              {notebook.name}
            </Text>
            <IconButton
              icon="plus"
              size={18}
              onPress={() => onAddChapter(notebook.id, selectedDate)}
              accessibilityLabel={t('screen.addChapterA11y', {
                name: notebook.name,
                date: formatFullDate(selectedDate),
              })}
              style={styles.addChapter}
            />
          </View>

          {entries.length === 0 ? (
            <Pressable
              onPress={() => onOpenJournal(notebook.id, selectedDate)}
              accessibilityRole="button"
              accessibilityLabel={t('screen.addJournalForA11y', {
                date: formatFullDate(selectedDate),
              })}
              style={({ pressed }) => [styles.chapter, pressed && styles.pressed]}
            >
              <QuietText variant="bodyMedium">{t('screen.writeHint')}</QuietText>
            </Pressable>
          ) : (
            entries.map((entry, position) => (
              <Pressable
                key={entry.id}
                onPress={() => onOpenJournal(notebook.id, selectedDate, entry.id)}
                accessibilityRole="button"
                accessibilityLabel={t('screen.openChapterA11y', {
                  number: position + 1,
                  name: notebook.name,
                  date: formatFullDate(selectedDate),
                })}
                style={({ pressed }) => [
                  styles.chapter,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderRadius: isCartoon ? deco.radius.sm : 12,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {entries.length > 1 ? (
                  <QuietText variant="labelSmall">
                    {t('screen.chapterHeading', { number: position + 1 })}
                  </QuietText>
                ) : null}
                <Text variant="bodyMedium" numberOfLines={8}>
                  {truncateNotePreview(entry.body, 400)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ))}

      {filter === 'all' && grouped.length === 0 && defaultNotebookId ? (
        <Pressable
          onPress={() => onOpenJournal(defaultNotebookId, selectedDate)}
          accessibilityRole="button"
          accessibilityLabel={t('screen.addJournalForA11y', {
            date: formatFullDate(selectedDate),
          })}
          style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.well,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderRadius: isCartoon ? deco.radius.sm : 12,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="notebook-outline"
              size={22}
              color={theme.colors.onPrimaryContainer}
            />
          </View>
          <View style={styles.entryText}>
            <Text variant="labelLarge">{t('screen.journalLabel')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('screen.writeHint')}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {showTrackerNotes && trackerNotes.length > 0 ? (
        <View
          style={[
            styles.trackerBlock,
            grouped.length > 0 && styles.trackerBlockAfterGroups,
          ]}
        >
          <Text
            variant="labelMedium"
            style={[styles.trackerLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            {t('screen.trackerNotesLabel')}
          </Text>
          {trackerNotes.map((row) => (
            <Pressable
              key={row.elementId}
              onPress={() => onOpenTrackerNote(row, selectedDate)}
              accessibilityRole="button"
              accessibilityLabel={t('screen.editNoteForA11y', { name: row.name })}
              style={({ pressed }) => [styles.trackerRow, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name="note-text-outline"
                size={18}
                color={theme.colors.primary}
                style={styles.trackerIcon}
              />
              <View style={styles.entryText}>
                <Text variant="bodyMedium">{row.name}</Text>
                <Text
                  variant="bodySmall"
                  numberOfLines={2}
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {truncateNotePreview(row.body, 120)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showEmptyTrackerNotes ? (
        <Text variant="bodySmall" style={[styles.emptyTrackers, { color: theme.colors.onSurfaceVariant }]}>
          {t('screen.noTrackerNotes')}
        </Text>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 16,
    gap: 4,
    overflow: 'hidden',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  group: {
    paddingVertical: space.md,
    gap: space.sm,
  },
  /** Separated from the group above by space rather than a rule. */
  groupAfterFirst: {
    paddingTop: space.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  groupName: {
    flex: 1,
    minWidth: 0,
  },
  addChapter: {
    margin: 0,
  },
  chapter: {
    padding: space.md,
    gap: space.xs,
    minHeight: 44,
  },
  pressed: { opacity: 0.7 },
  well: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  trackerBlock: {
    paddingTop: 8,
    gap: 4,
  },
  trackerBlockAfterGroups: {
    paddingTop: space.lg,
  },
  trackerLabel: {
    marginBottom: 4,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  trackerIcon: {
    marginTop: 2,
  },
  emptyTrackers: {
    paddingTop: 8,
  },
});
