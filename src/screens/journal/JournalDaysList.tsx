import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import Rule from '../../components/Rule';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
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
  const { decorations: deco } = useAppTheme();

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
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        {t('screen.daysLabel')}
      </Text>
      <Surface
        style={[
          styles.surface,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
          },
        ]}
        elevation={0}
      >
        {items.map((item, index) => {
          const selected = item.date === selectedDate;
          return (
            <React.Fragment key={item.key}>
              {index > 0 ? <Rule style={styles.rule} /> : null}
              <Pressable
                onPress={() => onSelectDate(item.date)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t('screen.viewDayA11y', { title: item.title })}
                style={({ pressed }) => [
                  styles.row,
                  selected
                    ? { backgroundColor: theme.colors.primaryContainer }
                    : pressed
                      ? { backgroundColor: theme.colors.surfaceVariant }
                      : null,
                ]}
              >
                <View
                  style={[
                    styles.accent,
                    {
                      backgroundColor: selected ? theme.colors.primary : 'transparent',
                      borderRadius: deco.radius.xs,
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
                  color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
                <View style={styles.rowText}>
                  <Text style={[typeScale.rowName, { color: theme.colors.onSurface }]}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <QuietText style={typeScale.secondary} numberOfLines={2}>
                      {item.description}
                    </QuietText>
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

/** Where a row's words start: accent, its gap, the glyph and its gap. */
const TEXT_INSET = space.sm + 3 + space.md + 22 + space.md;

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  sectionTitle: { ...typeScale.caption, fontSize: 14, paddingHorizontal: space.xs },
  surface: { overflow: 'hidden' },
  rule: { marginLeft: TEXT_INSET },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingRight: space.lg,
    paddingLeft: space.sm,
    minHeight: 64,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
});
