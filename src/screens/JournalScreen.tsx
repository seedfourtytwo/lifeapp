import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import * as journalNotebookRepo from '../db/repositories/journalNotebookRepository';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import { type DailyJournal, type ElementDefinition, type JournalNotebook } from '../protocol';
import { currentAppCalendarDate } from '../utils/dayRollover';
import JournalDayPanel, { type TrackerNoteRow } from './journal/JournalDayPanel';
import JournalDaysList from './journal/JournalDaysList';
import JournalNotebooksSection from './journal/JournalNotebooksSection';

type DayFilter = 'all' | 'trackers' | string;

export default function JournalScreen() {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);
  const [notebooks, setNotebooks] = useState<JournalNotebook[]>([]);
  const [journals, setJournals] = useState<DailyJournal[]>([]);
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState<DayFilter>('all');
  const [trackerNotes, setTrackerNotes] = useState<TrackerNoteRow[]>([]);
  const [noteOnlyDates, setNoteOnlyDates] = useState<string[]>([]);
  const [trackerNoteDates, setTrackerNoteDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const noteEditor = useNoteEditorSession();
  const editingRef = useRef(false);
  const wasEditingRef = useRef(false);
  editingRef.current = noteEditor.session != null;

  const notebookById = useMemo(() => {
    const map = new Map<string, JournalNotebook>();
    for (const notebook of notebooks) map.set(notebook.id, notebook);
    return map;
  }, [notebooks]);

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
      const nb = await journalNotebookRepo.getAllNotebooks(db);
      const rows = await dailyJournalRepo.getAllJournals(db);
      const noteOnly = await dayNoteRepo.getDatesWithTrackerNotesOnly(db, activeIds, today);
      const trackerDates = await dayNoteRepo.getDatesWithTrackerNotes(db, activeIds);
      setNotebooks(nb);
      setJournals(rows);
      setElements(active);
      setNoteOnlyDates(noteOnly);
      setTrackerNoteDates(trackerDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('screen.couldNotLoadJournalsFallback'));
    } finally {
      setLoading(false);
    }
  }, [today, t]);

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
    const open = noteEditor.session != null;
    if (wasEditingRef.current && !open) {
      void reload();
    }
    wasEditingRef.current = open;
  }, [noteEditor.session, reload]);

  useEffect(() => {
    if (noteEditor.session != null) return;
    void loadTrackerNotes(selectedDate, elements);
  }, [selectedDate, elements, loadTrackerNotes, noteEditor.session]);

  const openJournalDay = (notebookId: string, date: string) => {
    const notebook = notebookById.get(notebookId);
    void noteEditor.open(
      {
        kind: 'journal',
        notebookId,
        label: notebook?.name,
        icon: notebook?.icon,
      },
      date,
    );
  };

  const openTrackerNote = (row: TrackerNoteRow, date: string) => {
    void noteEditor.open(
      { kind: 'tracker', elementId: row.elementId, label: row.name },
      date,
    );
  };

  const showTrackerNotes = filter === 'all' || filter === 'trackers';
  const extraDates =
    filter === 'trackers'
      ? trackerNoteDates.filter((date) => date !== today)
      : filter === 'all'
        ? noteOnlyDates
        : [];

  const editorHost = <NoteEditorHost session={noteEditor} />;

  const renderFilterChip = (id: DayFilter, label: string) => {
    const selected = filter === id;
    return (
      <Pressable
        key={id}
        onPress={() => setFilter(id)}
        style={[
          styles.chip,
          {
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
            backgroundColor: selected
              ? theme.colors.primaryContainer
              : theme.colors.surface,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
      >
        <Text
          variant="labelMedium"
          style={{ color: selected ? theme.colors.primary : theme.colors.onSurface }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  if (loading && journals.length === 0 && notebooks.length === 0 && !error) {
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
              {t('screen.retry')}
            </Button>
          </View>
        ) : null}

        <JournalNotebooksSection notebooks={notebooks} onChanged={() => void reload()} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {renderFilterChip('all', t('screen.filterAll'))}
          {notebooks.map((notebook) => renderFilterChip(notebook.id, notebook.name))}
          {renderFilterChip('trackers', t('screen.trackerNotesLabel'))}
        </ScrollView>

        <JournalDayPanel
          selectedDate={selectedDate}
          today={today}
          notebooks={notebooks}
          journals={journals}
          trackerNotes={trackerNotes}
          showTrackerNotes={showTrackerNotes}
          filter={filter}
          onOpenJournal={openJournalDay}
          onOpenTrackerNote={openTrackerNote}
        />

        <JournalDaysList
          today={today}
          selectedDate={selectedDate}
          journals={journals}
          filter={filter}
          extraDates={extraDates}
          todayTrackerPreview={trackerNotes.length > 0}
          onSelectDate={setSelectedDate}
        />
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
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
