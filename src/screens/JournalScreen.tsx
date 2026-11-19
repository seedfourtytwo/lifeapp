import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import { type DailyJournal, type ElementDefinition, type JournalNotebook } from '../protocol';
import { journalDayEntries, type JournalFilter } from './journal/journalDays';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { newId } from '../utils/id';
import { useHomePager } from './home/HomePagerContext';
import type { HomePageProps } from './home/homePager';
import JournalDayPanel, { type TrackerNoteRow } from './journal/JournalDayPanel';
import JournalDaysList from './journal/JournalDaysList';
import JournalNotebooksSection from './journal/JournalNotebooksSection';
import NotebookChip from './journal/NotebookChip';
import PageHeader from './shared/PageHeader';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

/**
 * The Journal page of the Home pager: a place to write, then what was written.
 *
 * Top to bottom: the day being written (today, unless a past day was opened),
 * a row of notebook names to narrow by when there is more than one, and the
 * days themselves, set as prose. Managing notebooks is a sheet behind the
 * header's glyph and takes no room on the page.
 *
 * It reads the database, so it loads when it becomes the page on screen
 * (`active`) rather than when it is built — a drag beside it builds it — and
 * again each time the user comes back to it.
 */
export default function JournalScreen({ active }: HomePageProps) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { t: tHome } = useTranslation('home');
  const setPagerSwipeLocked = useHomePager()?.setSwipeLocked;
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef<ScrollView>(null);
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);
  const notebooks = useJournalNotebookStore((s) => s.notebooks);
  const reloadNotebooks = useJournalNotebookStore((s) => s.reload);
  const [journals, setJournals] = useState<DailyJournal[]>([]);
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState<JournalFilter>('all');
  /** The notebook the tile writes in; unset means the first. */
  const [writingIn, setWritingIn] = useState<string | undefined>(undefined);
  const [notebooksOpen, setNotebooksOpen] = useState(false);
  const [trackerNotes, setTrackerNotes] = useState<TrackerNoteRow[]>([]);
  const [noteOnlyDates, setNoteOnlyDates] = useState<string[]>([]);
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
      setJournals(rows);
      setElements(active);
      setNoteOnlyDates(noteOnly);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('screen.couldNotLoadJournalsFallback'));
    } finally {
      setLoading(false);
    }
  }, [today, t, reloadNotebooks]);

  // Stack focus covers coming back from a pushed screen; `active` covers the
  // pager, whose swipes and dock taps raise no focus event.
  useFocusEffect(
    useCallback(() => {
      if (!active || editingRef.current) return;
      setLoading(true);
      void reload();
    }, [reload, active]),
  );

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  useEffect(() => {
    if (filter === 'all') return;
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

  const openChapter = (
    notebookId: string,
    date: string,
    entryId: string | undefined,
    opts?: { dictate: boolean },
  ) => {
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
      opts?.dictate ? { dictate: true } : undefined,
    );
  };

  /**
   * Writing on a day that already has chapters starts a fresh one: a row id
   * minted before there is any text. The editor opens blank and the row
   * appears on the first save, so abandoning it leaves nothing behind. A day
   * with nothing yet opens its first chapter.
   */
  const writeInDay = (notebookId: string, date: string, opts: { dictate: boolean }) => {
    const hasChapters = journals.some(
      (journal) => journal.date === date && journal.notebookId === notebookId,
    );
    openChapter(notebookId, date, hasChapters ? newId() : undefined, opts);
  };

  const openTrackerNote = (row: TrackerNoteRow, date: string) => {
    void noteEditor.open(
      { kind: 'tracker', elementId: row.elementId, label: row.name },
      date,
    );
  };

  /** A day tapped in the list moves into the tile at the top, so go there. */
  const openDay = (date: string, notebookId?: string) => {
    setSelectedDate(date);
    if (notebookId) setWritingIn(notebookId);
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  };

  const chooseFilter = (next: JournalFilter) => {
    setFilter(next);
    // Narrowing to a notebook is also saying which one you mean to write in.
    if (next !== 'all') setWritingIn(next);
  };

  const dayEntries = useMemo(
    () => journalDayEntries(journals, notebooks, filter),
    [journals, notebooks, filter],
  );
  const severalNotebooks = notebooks.length > 1;
  /** A notebook that has since been deleted falls back to the first. */
  const writingInId = (writingIn != null && notebookById.has(writingIn) ? writingIn : undefined) ??
    notebooks[0]?.id;

  const editorHost = <NoteEditorHost session={noteEditor} />;

  const header = (
    <PageHeader
      title={tHome('dock.journal')}
      actions={
        <IconButton
          icon="notebook-multiple"
          size={24}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => setNotebooksOpen(true)}
          accessibilityLabel={t('notebooks.title')}
          style={styles.headerAction}
        />
      }
    />
  );
  const notebooksSheet = (
    <JournalNotebooksSection
      visible={notebooksOpen}
      onDismiss={() => setNotebooksOpen(false)}
      notebooks={notebooks}
      onChanged={() => void reload()}
    />
  );

  // The title is known before any entry is, so it is already in place.
  if (loading && journals.length === 0 && notebooks.length === 0 && !error) {
    return (
      <>
        <View style={styles.loadingPane}>
          {header}
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        </View>
        {notebooksSheet}
        {editorHost}
      </>
    );
  }

  return (
    <>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
        {header}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={[typeScale.secondary, { color: theme.colors.error }]}>{error}</Text>
            <Button mode="text" compact onPress={() => void reload()} style={styles.retry}>
              {t('screen.retry')}
            </Button>
          </View>
        ) : null}

        <JournalDayPanel
          selectedDate={selectedDate}
          today={today}
          notebooks={notebooks}
          journals={journals}
          notebookId={writingInId}
          onChooseNotebook={setWritingIn}
          trackerNotes={trackerNotes}
          showTrackerNotes={filter === 'all'}
          onOpenChapter={openChapter}
          onWrite={writeInDay}
          onOpenTrackerNote={openTrackerNote}
          onBackToToday={() => setSelectedDate(today)}
        />

        {severalNotebooks ? (
          /*
            A sideways scroller inside the sideways pager. Android hands a
            horizontal drag to the outer one, so while a finger is down in this
            row the pager is held still and the row scrolls. Once the row has
            the drag the system keeps it there, so releasing the hold on cancel
            — which is what the row's own scroll start sends — is safe.
          */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroller}
            contentContainerStyle={styles.filterRow}
            accessibilityRole="radiogroup"
            onTouchStart={() => setPagerSwipeLocked?.(true)}
            onTouchEnd={() => setPagerSwipeLocked?.(false)}
            onTouchCancel={() => setPagerSwipeLocked?.(false)}
          >
            <NotebookChip
              ground="page"
              label={t('screen.filterAll')}
              selected={filter === 'all'}
              onPress={() => chooseFilter('all')}
            />
            {notebooks.map((notebook) => (
              <NotebookChip
                key={notebook.id}
                ground="page"
                label={notebook.name}
                notebook={notebook}
                selected={filter === notebook.id}
                onPress={() => chooseFilter(notebook.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        <JournalDaysList
          today={today}
          selectedDate={selectedDate}
          openNotebookId={writingInId}
          entries={dayEntries}
          notebooks={notebooks}
          showNotebook={severalNotebooks && filter === 'all'}
          trackerNoteDates={filter === 'all' ? noteOnlyDates : []}
          onOpenDay={openDay}
        />
      </ScrollView>

      {notebooksSheet}
      {editorHost}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.gutter,
    // The Home pages' top edge, so the title sits where the date does.
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: layout.sectionGap,
    flexGrow: 1,
  },
  loadingPane: {
    flex: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    gap: space.xs,
  },
  retry: {
    alignSelf: 'flex-start',
    marginLeft: -space.sm,
  },
  /** Flush with the gutter: the glyph's own box supplies the breathing room. */
  headerAction: {
    margin: 0,
  },
  /** Runs to the screen's edges, so chips scroll out from under the gutter. */
  filterScroller: {
    marginHorizontal: -layout.gutter,
  },
  filterRow: {
    gap: space.sm,
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    // Room for the chips' 48dp touch target above and below the 40dp pill.
    paddingVertical: space.xs,
  },
});
