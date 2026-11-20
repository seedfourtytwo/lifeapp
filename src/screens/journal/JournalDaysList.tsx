import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { notebookInk } from '../../notes/notebookInk';
import type { JournalNotebook } from '../../protocol';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { truncateNotePreview } from '../../utils/trackerHistoryFormat';
import { formatJournalDay } from './journalDates';
import type { JournalDayEntry } from './journalDays';

/** The notebook's colour mark beside its name; half of it is its radius. */
const DOT = 8;
/** How much of a day shows before it is opened. */
const PREVIEW_LINES = 4;
/** Enough characters to fill those lines on a wide screen, and no more to lay out. */
const PREVIEW_CHARS = 400;

type Props = {
  today: string;
  /** The day and notebook open in the tile above; that entry is not repeated here. */
  selectedDate: string;
  openNotebookId: string | undefined;
  /** Days with something written, newest first. */
  entries: JournalDayEntry[];
  notebooks: JournalNotebook[];
  /** Say which notebook each day is from — when showing all of several. */
  showNotebook: boolean;
  /** Days that hold only tracker notes, newest first; empty when filtered. */
  trackerNoteDates: string[];
  onOpenDay: (date: string, notebookId?: string) => void;
};

/**
 * The days, written on the page: a quiet line saying which day, then what was
 * written, set in the display face at reading size. No tiles, no rules, no
 * glyphs — the space between days is what separates them, and the words are
 * what you came for. A day shows its first few lines; tapping it opens the
 * whole day in the tile at the top.
 */
export default function JournalDaysList({
  today,
  selectedDate,
  openNotebookId,
  entries,
  notebooks,
  showNotebook,
  trackerNoteDates,
  onOpenDay,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco, themeMode } = useAppTheme();
  const notebookById = new Map(notebooks.map((notebook) => [notebook.id, notebook]));

  if (entries.length === 0 && trackerNoteDates.length === 0) {
    return <QuietText style={[typeScale.secondary, styles.empty]}>{t('screen.emptyDays')}</QuietText>;
  }

  type Row =
    | { kind: 'entry'; date: string; key: string; entry: JournalDayEntry }
    | { kind: 'trackerNotes'; date: string; key: string };

  const rows: Row[] = [
    ...entries.map((entry): Row => ({ kind: 'entry', date: entry.date, key: entry.key, entry })),
    ...trackerNoteDates.map(
      (date): Row => ({ kind: 'trackerNotes', date, key: `tracker-notes|${date}` }),
    ),
  ]
    .filter(
      (row) =>
        row.date !== selectedDate ||
        (row.kind === 'entry' && row.entry.notebookId !== openNotebookId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.days}>
      {rows.map((row) => {
        const day = row.date === today ? t('screen.today') : formatJournalDay(row.date, today);
        const notebook = row.kind === 'entry' ? notebookById.get(row.entry.notebookId) : undefined;
        return (
          <Pressable
            key={row.key}
            onPress={() => onOpenDay(row.date, row.kind === 'entry' ? row.entry.notebookId : undefined)}
            accessibilityRole="button"
            accessibilityLabel={t('screen.viewDayA11y', { title: day })}
            style={({ pressed }) => [
              styles.day,
              pressed && { backgroundColor: theme.colors.surface, borderRadius: deco.radius.md },
            ]}
          >
            <View style={styles.caption}>
              <QuietText style={typeScale.caption}>{day}</QuietText>
              {showNotebook && notebook ? (
                <View style={styles.notebook}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: notebookInk(notebook.color, themeMode) },
                    ]}
                  />
                  <QuietText style={[typeScale.caption, styles.notebookName]} numberOfLines={1}>
                    {notebook.name}
                  </QuietText>
                </View>
              ) : null}
            </View>
            {row.kind === 'entry' ? (
              <Text
                style={[typeScale.reading, { color: theme.colors.onSurface }]}
                numberOfLines={PREVIEW_LINES}
              >
                {truncateNotePreview(row.entry.text, PREVIEW_CHARS)}
              </Text>
            ) : (
              <QuietText style={typeScale.secondary}>{t('screen.trackerNotesOnly')}</QuietText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  days: {
    gap: space.xl,
  },
  /** Bled past the text so the pressed wash has room round the words. */
  day: {
    marginHorizontal: -space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    gap: space.xs,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: space.md,
  },
  notebook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  notebookName: {
    flexShrink: 1,
  },
  dot: {
    width: DOT,
    height: DOT,
    // Geometry: half the box is what makes the dot round.
    borderRadius: DOT / 2,
  },
  empty: {
    paddingHorizontal: space.xs,
  },
});
