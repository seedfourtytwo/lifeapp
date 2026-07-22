import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import { type DailyJournal, type ElementDefinition } from '../protocol';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { formatFullDate } from '../utils/dates';
import { truncateNotePreview } from '../utils/trackerHistoryFormat';

type TrackerNoteRow = {
  elementId: string;
  name: string;
  body: string;
};

export default function JournalScreen() {
  const theme = useTheme();
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);
  const [journals, setJournals] = useState<DailyJournal[]>([]);
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [trackerNotes, setTrackerNotes] = useState<TrackerNoteRow[]>([]);
  const [noteOnlyDates, setNoteOnlyDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const noteEditor = useNoteEditorSession({
    onSaved: () => {
      void reload();
    },
  });
  const editingRef = useRef(false);
  editingRef.current = noteEditor.session != null;

  const loadTrackerNotes = useCallback(
    async (date: string, activeElements: ElementDefinition[]) => {
      if (activeElements.length === 0) {
        setTrackerNotes([]);
        return;
      }
      const db = await getDatabase();
      const notes = await dayNoteRepo.getNotesForElementsOnDate(
        db,
        activeElements.map((el) => el.id),
        date,
      );
      const rows: TrackerNoteRow[] = [];
      for (const el of activeElements) {
        const note = notes.get(el.id);
        if (note) rows.push({ elementId: el.id, name: el.name, body: note.body });
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setTrackerNotes(rows);
    },
    [],
  );

  const reload = useCallback(async () => {
    setError(null);
    try {
      const db = await getDatabase();
      const allElements = await elementRepo.getAllElements(db);
      const active = allElements.filter((el) => !el.archivedAt);
      const activeIds = active.map((el) => el.id);
      const [rows, noteOnly] = await Promise.all([
        dailyJournalRepo.getAllJournals(db),
        dayNoteRepo.getDatesWithTrackerNotesOnly(db, activeIds, today),
      ]);
      setJournals(rows);
      setElements(active);
      setNoteOnlyDates(noteOnly);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load journals');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      if (editingRef.current) return;
      setLoading(true);
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  useEffect(() => {
    if (editingRef.current) return;
    void loadTrackerNotes(selectedDate, elements);
  }, [selectedDate, elements, loadTrackerNotes]);

  const openJournal = (date: string) => {
    void noteEditor.open({ kind: 'journal' }, date);
  };

  const openTrackerNote = (row: TrackerNoteRow, date: string) => {
    void noteEditor.open(
      { kind: 'tracker', elementId: row.elementId, label: row.name },
      date,
    );
  };

  const journalForSelected = journals.find((j) => j.date === selectedDate);
  const todayJournal = journals.find((j) => j.date === today);
  const hasJournal = journalForSelected != null;
  const pastJournals = journals.filter((j) => j.date !== today);
  const editorHost = <NoteEditorHost session={noteEditor} />;

  const renderDayPickerRow = (
    date: string,
    title: string,
    preview: string,
    hasJournalEntry: boolean,
  ) => {
    const selected = date === selectedDate;
    return (
      <Pressable
        key={date}
        onPress={() => setSelectedDate(date)}
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
        accessibilityLabel={`View ${title}`}
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

  if (loading && journals.length === 0 && !error) {
    return (
      <>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
        {editorHost}
      </>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={{ color: theme.colors.error }}>{error}</Text>
            <Button mode="outlined" onPress={() => void reload()}>
              Retry
            </Button>
          </View>
        ) : null}

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
            {selectedDate === today ? 'Today' : formatFullDate(selectedDate)}
          </Text>

          <Pressable
            onPress={() => openJournal(selectedDate)}
            accessibilityRole="button"
            accessibilityLabel={
              hasJournal
                ? `Edit journal for ${formatFullDate(selectedDate)}`
                : `Add journal for ${formatFullDate(selectedDate)}`
            }
            style={styles.journalRow}
          >
            <MaterialCommunityIcons
              name={hasJournal ? 'notebook' : 'notebook-outline'}
              size={16}
              color={hasJournal ? theme.colors.primary : theme.colors.onSurfaceVariant}
              style={styles.noteIcon}
            />
            <View style={styles.journalText}>
              <Text variant="labelMedium">Journal</Text>
              <Text
                variant="bodySmall"
                numberOfLines={3}
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {hasJournal
                  ? truncateNotePreview(journalForSelected?.body ?? '', 160)
                  : 'Tap to write journal'}
              </Text>
            </View>
          </Pressable>

          {trackerNotes.length > 0 ? (
            <View style={styles.trackerNotesSection}>
              <Text variant="labelMedium" style={styles.trackerNotesLabel}>
                Tracker notes
              </Text>
              {trackerNotes.map((row) => (
                <Pressable
                  key={row.elementId}
                  onPress={() => openTrackerNote(row, selectedDate)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit note for ${row.name}`}
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
              No tracker notes this day.
            </Text>
          )}
        </View>

        <Text variant="labelLarge" style={styles.sectionLabel}>
          Days
        </Text>

        {renderDayPickerRow(
          today,
          'Today',
          todayJournal
            ? truncateNotePreview(todayJournal.body, 80)
            : 'No journal yet',
          todayJournal != null,
        )}

        {pastJournals.length === 0 && !todayJournal && noteOnlyDates.length === 0 ? (
          <Text variant="bodyMedium" style={styles.empty}>
            Write from Home or here — pick a day above to review notes.
          </Text>
        ) : null}

        {pastJournals.map((journal) =>
          renderDayPickerRow(
            journal.date,
            formatFullDate(journal.date),
            truncateNotePreview(journal.body, 80),
            true,
          ),
        )}

        {noteOnlyDates.map((date) =>
          renderDayPickerRow(date, formatFullDate(date), 'Tracker notes only', false),
        )}
      </ScrollView>

      {editorHost}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    gap: 8,
    marginBottom: 8,
  },
  dayPanel: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    gap: 4,
  },
  dayTitle: {
    marginBottom: 6,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000022',
  },
  journalText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trackerNotesSection: {
    gap: 8,
    paddingTop: 10,
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
    paddingTop: 10,
  },
  noteIcon: {
    marginRight: 8,
    marginTop: 1,
  },
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
