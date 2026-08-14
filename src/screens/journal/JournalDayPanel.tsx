import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
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
  onOpenJournal: (notebookId: string, date: string) => void;
  onOpenTrackerNote: (row: TrackerNoteRow, date: string) => void;
};

/** Selected-day card: one preview per notebook, plus tracker notes. */
export default function JournalDayPanel({
  selectedDate,
  today,
  notebooks,
  journals,
  trackerNotes,
  showTrackerNotes,
  filter,
  onOpenJournal,
  onOpenTrackerNote,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
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

  return (
    <View
      style={[
        styles.dayPanel,
        {
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text variant="titleSmall" style={styles.dayTitle}>
        {selectedDate === today ? t('screen.today') : formatFullDate(selectedDate)}
      </Text>

      {grouped.map(({ notebook, entries }) => (
        <View
          key={notebook.id}
          style={[styles.notebookGroup, { borderBottomColor: theme.colors.outlineVariant }]}
        >
          <View style={styles.notebookHeader}>
            <View style={[styles.swatch, { backgroundColor: notebook.color }]} />
            <Text variant="labelMedium" style={styles.notebookTitle}>
              {notebook.name}
            </Text>
          </View>
          <Pressable
            onPress={() => onOpenJournal(notebook.id, selectedDate)}
            accessibilityRole="button"
            accessibilityLabel={
              entries.length === 0
                ? t('screen.addJournalForA11y', { date: formatFullDate(selectedDate) })
                : t('screen.editJournalForA11y', { date: formatFullDate(selectedDate) })
            }
            style={styles.journalRow}
          >
            <Text
              variant="bodySmall"
              numberOfLines={entries.length === 0 ? 1 : 6}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {entries.length === 0
                ? t('screen.tapToWriteNotebook', { name: notebook.name })
                : truncateNotePreview(entries[0]?.body ?? '', 400)}
            </Text>
          </Pressable>
        </View>
      ))}

      {filter === 'all' && grouped.length === 0 && defaultNotebookId ? (
        <Pressable
          onPress={() => onOpenJournal(defaultNotebookId, selectedDate)}
          accessibilityRole="button"
          accessibilityLabel={t('screen.addJournalForA11y', {
            date: formatFullDate(selectedDate),
          })}
          style={styles.journalRow}
        >
          <Text variant="labelMedium">{t('screen.journalLabel')}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('screen.tapToWriteJournal')}
          </Text>
        </Pressable>
      ) : null}

      {showTrackerNotes ? (
        trackerNotes.length > 0 ? (
          <View style={styles.trackerNotesSection}>
            <Text variant="labelMedium" style={styles.trackerNotesLabel}>
              {t('screen.trackerNotesLabel')}
            </Text>
            {trackerNotes.map((row) => (
              <Pressable
                key={row.elementId}
                onPress={() => onOpenTrackerNote(row, selectedDate)}
                accessibilityRole="button"
                accessibilityLabel={t('screen.editNoteForA11y', { name: row.name })}
                style={styles.trackerNoteRow}
              >
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={14}
                  color={theme.colors.primary}
                  style={styles.noteIcon}
                />
                <View style={styles.trackerNoteText}>
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
        ) : (
          <Text variant="bodySmall" style={styles.noTrackerNotes}>
            {t('screen.noTrackerNotes')}
          </Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dayPanel: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    gap: 8,
  },
  dayTitle: {
    marginBottom: 2,
  },
  notebookGroup: {
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notebookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notebookTitle: {
    flex: 1,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  journalRow: {
    paddingBottom: 4,
  },
  trackerNotesSection: {
    gap: 8,
    paddingTop: 4,
  },
  trackerNotesLabel: {
    opacity: 0.85,
  },
  trackerNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  trackerNoteText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  noTrackerNotes: {
    opacity: 0.6,
    paddingTop: 4,
  },
  noteIcon: {
    marginRight: 8,
    marginTop: 1,
  },
});
