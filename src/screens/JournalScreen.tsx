import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useAppTheme } from '../hooks/useAppTheme';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import { type DailyJournal, type ElementDefinition, type JournalNotebook } from '../protocol';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { newId } from '../utils/id';
import JournalDayPanel, { type TrackerNoteRow } from './journal/JournalDayPanel';
import JournalDaysList from './journal/JournalDaysList';
import JournalNotebooksSection from './journal/JournalNotebooksSection';

type DayFilter = 'all' | 'trackers' | string;

export default function JournalScreen() {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco, isCartoon } = useAppTheme();
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);
  const notebooks = useJournalNotebookStore((s) => s.notebooks);
  const reloadNotebooks = useJournalNotebookStore((s) => s.reload);
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
      try {
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
      } catch {
        setTrackerNotes([]);
      }
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
      await reloadNotebooks();
      const rows = await dailyJournalRepo.getAllJournals(db);
      const noteOnly = await dayNoteRepo.getDatesWithTrackerNotesOnly(db, activeIds, today);
      const trackerDates = await dayNoteRepo.getDatesWithTrackerNotes(db, activeIds);
      setJournals(rows);
      setElements(active);
      setNoteOnlyDates(noteOnly);
      setTrackerNoteDates(trackerDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('screen.couldNotLoadJournalsFallback'));
    } finally {
      setLoading(false);
    }
  }, [today, t, reloadNotebooks]);

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
    if (filter === 'all' || filter === 'trackers') return;
    if (!notebooks.some((notebook) => notebook.id === filter)) {
      setFilter('all');
    }
  }, [notebooks, filter]);

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

  const openJournalDay = (notebookId: string, date: string, entryId?: string) => {
    const notebook = notebookById.get(notebookId);
    void noteEditor.open(
      {
        kind: 'journal',
        notebookId,
        entryId,
        label: notebook?.name,
        icon: notebook?.icon,
      },
      date,
    );
  };

  /**
   * A fresh chapter is a row id minted before there is any text: the editor
   * opens blank and the row appears on the first save, so abandoning it leaves
   * nothing behind.
   */
  const addJournalChapter = (notebookId: string, date: string) => {
    openJournalDay(notebookId, date, newId());
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

  const renderFilterWell = (
    id: DayFilter,
    label: string,
    icon: React.ReactNode,
    tint?: string,
  ) => {
    const selected = filter === id;
    const bg = selected
      ? tint
        ? `${tint}33`
        : theme.colors.primaryContainer
      : theme.colors.surfaceVariant;
    return (
      <Pressable
        key={id}
        onPress={() => setFilter(id)}
        style={[
          styles.filterWell,
          {
            backgroundColor: bg,
            borderRadius: isCartoon ? deco.radius.sm : 12,
            borderColor: selected ? (tint ?? theme.colors.primary) : 'transparent',
            borderWidth: selected ? (isCartoon ? deco.borderWidth : 1.5) : 0,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
      >
        {icon}
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
          contentContainerStyle={styles.filterRow}
        >
          {renderFilterWell(
            'all',
            t('screen.filterAll'),
            <MaterialCommunityIcons
              name="view-grid-outline"
              size={22}
              color={filter === 'all' ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />,
          )}
          {notebooks.map((notebook) =>
            renderFilterWell(
              notebook.id,
              notebook.name,
              notebook.icon ? (
                <TrackerIcon name={notebook.icon} size={22} color={notebook.color} />
              ) : (
                <MaterialCommunityIcons
                  name="notebook-outline"
                  size={22}
                  color={notebook.color}
                />
              ),
              notebook.color,
            ),
          )}
          {renderFilterWell(
            'trackers',
            t('screen.trackerNotesLabel'),
            <MaterialCommunityIcons
              name="note-text-outline"
              size={22}
              color={
                filter === 'trackers' ? theme.colors.primary : theme.colors.onSurfaceVariant
              }
            />,
          )}
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
          onAddChapter={addJournalChapter}
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
    gap: 16,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    gap: 8,
  },
  filterRow: {
    gap: 8,
    alignItems: 'center',
  },
  filterWell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
