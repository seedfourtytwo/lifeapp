import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { DailyJournal } from '../../protocol';
import { formatFullDate } from '../../utils/dates';
import { truncateNotePreview } from '../../utils/trackerHistoryFormat';

type DayFilter = 'all' | 'trackers' | string;

type Props = {
  today: string;
  selectedDate: string;
  journals: DailyJournal[];
  filter: DayFilter;
  extraDates: string[];
  todayTrackerPreview: boolean;
  onSelectDate: (date: string) => void;
};

/** Day picker under the selected-day card. */
export default function JournalDaysList({
  today,
  selectedDate,
  journals,
  filter,
  extraDates,
  todayTrackerPreview,
  onSelectDate,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');

  const journalDates = (() => {
    const seen = new Set<string>();
    const dates: { date: string; preview: string }[] = [];
    for (const journal of journals) {
      if (filter !== 'all' && filter !== 'trackers' && journal.notebookId !== filter) {
        continue;
      }
      if (filter === 'trackers') continue;
      if (seen.has(journal.date)) continue;
      seen.add(journal.date);
      dates.push({ date: journal.date, preview: journal.body });
    }
    return dates;
  })();

  const todayPreview = journalDates.find((row) => row.date === today);
  const pastJournalDates = journalDates.filter((row) => row.date !== today);

  const renderRow = (
    date: string,
    title: string,
    preview: string,
    hasJournalEntry: boolean,
  ) => {
    const selected = date === selectedDate;
    return (
      <Pressable
        key={`${filter}:${date}`}
        onPress={() => onSelectDate(date)}
        style={[
          styles.row,
          selected && styles.rowSelected,
          {
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
            backgroundColor: theme.colors.surface,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t('screen.viewDayA11y', { title })}
      >
        <MaterialCommunityIcons
          name={hasJournalEntry ? 'notebook' : 'notebook-outline'}
          size={22}
          color={
            hasJournalEntry
              ? theme.colors.primary
              : selected
                ? theme.colors.primary
                : theme.colors.onSurfaceVariant
          }
        />
        <View style={styles.rowText}>
          <Text variant="titleSmall">{title}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {preview}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Text variant="labelLarge" style={styles.sectionLabel}>
        {t('screen.daysLabel')}
      </Text>

      {renderRow(
        today,
        t('screen.today'),
        todayPreview
          ? truncateNotePreview(todayPreview.preview, 80)
          : filter === 'trackers'
            ? todayTrackerPreview
              ? t('screen.trackerNotesOnly')
              : t('screen.noJournalYet')
            : t('screen.noJournalYet'),
        todayPreview != null,
      )}

      {pastJournalDates.length === 0 && !todayPreview && extraDates.length === 0 ? (
        <Text variant="bodyMedium" style={styles.empty}>
          {t('screen.emptyHint')}
        </Text>
      ) : null}

      {pastJournalDates.map((row) =>
        renderRow(
          row.date,
          formatFullDate(row.date),
          truncateNotePreview(row.preview, 80),
          true,
        ),
      )}

      {extraDates.map((date) =>
        renderRow(date, formatFullDate(date), t('screen.trackerNotesOnly'), false),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: 4,
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  rowSelected: {
    borderWidth: 1.5,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  empty: {
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
