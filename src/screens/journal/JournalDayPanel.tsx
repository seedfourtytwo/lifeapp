import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { TrackerIcon } from '../../components/trackerIcons/TrackerIcon';
import { useAppTheme } from '../../hooks/useAppTheme';
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

/** Selected-day writing surface: previews first, tap to open the editor. */
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
          borderWidth: isCartoon ? deco.cardBorderWidth : StyleSheet.hairlineWidth,
        },
      ]}
      elevation={0}
    >
      <Text variant="titleMedium">{title}</Text>

      {grouped.map(({ notebook, entries }, index) => {
        const body = entries[0]?.body;
        const empty = !body;
        return (
          <Pressable
            key={notebook.id}
            onPress={() => onOpenJournal(notebook.id, selectedDate)}
            accessibilityRole="button"
            accessibilityLabel={
              empty
                ? t('screen.addJournalForA11y', { date: formatFullDate(selectedDate) })
                : t('screen.editJournalForA11y', { date: formatFullDate(selectedDate) })
            }
            style={({ pressed }) => [
              styles.entry,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.outlineVariant,
              },
              pressed && styles.pressed,
            ]}
          >
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
            <View style={styles.entryText}>
              <Text variant="labelLarge">{notebook.name}</Text>
              <Text
                variant="bodyMedium"
                numberOfLines={empty ? 1 : 8}
                style={{
                  color: empty ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                  opacity: empty ? 0.7 : 1,
                }}
              >
                {empty ? t('screen.writeHint') : truncateNotePreview(body, 400)}
              </Text>
            </View>
          </Pressable>
        );
      })}

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
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
              {t('screen.writeHint')}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {showTrackerNotes && trackerNotes.length > 0 ? (
        <View
          style={[
            styles.trackerBlock,
            grouped.length > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.outlineVariant,
            },
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
    opacity: 0.75,
  },
});
