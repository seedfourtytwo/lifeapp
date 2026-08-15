import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Divider, Surface, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
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

/** Timeline of days under the writing panel. */
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
  const { decorations: deco, isCartoon } = useAppTheme();

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

  const todayDescription = todayPreview
    ? truncateNotePreview(todayPreview.preview, 80)
    : filter === 'trackers'
      ? todayTrackerPreview
        ? t('screen.trackerNotesOnly')
        : undefined
      : undefined;

  type DayItem = {
    key: string;
    date: string;
    title: string;
    description?: string;
    filled: boolean;
    noteOnly?: boolean;
  };

  const items: DayItem[] = [
    {
      key: `today:${today}`,
      date: today,
      title: t('screen.today'),
      description: todayDescription,
      filled: todayPreview != null,
    },
    ...pastJournalDates.map((row) => ({
      key: `journal:${row.date}`,
      date: row.date,
      title: formatFullDate(row.date),
      description: truncateNotePreview(row.preview, 80),
      filled: true,
    })),
    ...extraDates.map((date) => ({
      key: `extra:${date}`,
      date,
      title: formatFullDate(date),
      description: t('screen.trackerNotesOnly'),
      filled: false,
      noteOnly: true,
    })),
  ];

  return (
    <View style={styles.wrap}>
      <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        {t('screen.daysLabel')}
      </Text>
      <Surface
        style={[
          styles.surface,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            borderRadius: deco.radius.md,
            borderWidth: isCartoon ? deco.cardBorderWidth : StyleSheet.hairlineWidth,
          },
        ]}
        elevation={0}
      >
        {items.map((item, index) => {
          const selected = item.date === selectedDate;
          return (
            <React.Fragment key={item.key}>
              {index > 0 ? (
                <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
              ) : null}
              <Pressable
                onPress={() => onSelectDate(item.date)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t('screen.viewDayA11y', { title: item.title })}
                style={({ pressed }) => [
                  styles.row,
                  selected && { backgroundColor: theme.colors.primaryContainer + '55' },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.accent,
                    {
                      backgroundColor: selected ? theme.colors.primary : 'transparent',
                      borderRadius: isCartoon ? 3 : 2,
                    },
                  ]}
                />
                <MaterialCommunityIcons
                  name={
                    item.noteOnly
                      ? 'note-text-outline'
                      : item.filled
                        ? 'notebook'
                        : 'notebook-outline'
                  }
                  size={22}
                  color={
                    item.filled || selected
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
                <View style={styles.rowText}>
                  <Text variant="titleSmall">{item.title}</Text>
                  {item.description ? (
                    <Text
                      variant="bodySmall"
                      numberOfLines={2}
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </React.Fragment>
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionTitle: { paddingHorizontal: 8 },
  surface: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 16,
    paddingLeft: 8,
    minHeight: 52,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pressed: { opacity: 0.75 },
});
