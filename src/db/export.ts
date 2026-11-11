import { createProtocolBundle, parseProtocolBundle } from '../protocol';
import type { ProtocolBundle } from '../protocol';
import { CALENDAR_BACKUP_VERSION } from '../calendar/types';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as journalNotebookRepo from '../db/repositories/journalNotebookRepository';
import * as calendarRepo from '../db/repositories/calendarRepository';
import * as foodRepo from '../db/repositories/foodRepository';
import * as todoRepo from '../db/repositories/todoRepository';
import { countRows, type BackedUpTable } from '../db/repositories/rowCountRepository';
import { markSeedFoodsApplied } from '../nutrition/seedCatalog';
import { readAppSettings, writeAppSettings } from './appSettingsBackup';
import { clearDataForImport } from './resetAppData';
import { normalizeProtocolBundleInput } from './normalizeProtocolBundle';
import { bumpAllDataGenerations, bumpDataGeneration } from './dataGeneration';
import { withDbWriteLock } from './writeLock';
import { takeSafetyCopy } from './safetyCopy';
import { newId } from '../utils/id';
import { awaitPendingEventWrites, useEventStore } from '../store/eventStore';
import { stopHabitSound } from '../audio/habitTimerSound';
import { i18n } from '../i18n';

export interface ExportedBundle {
  bundle: ProtocolBundle;
  /** Rows the repositories could not read and so left out of `bundle`. */
  skippedRows: number;
}

export async function exportProtocolBundle(): Promise<ExportedBundle> {
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
    const elements = await elementRepo.getAllElements(db);
    const dashboard = await dashboardRepo.getDashboardItems(db);
    const events = await eventRepo.getAllEvents(db);
    const dayNotesRaw = await dayNoteRepo.getAllNotes(db);
    const journalNotebooks = await journalNotebookRepo.getAllNotebooks(db);
    const dailyJournals = await dailyJournalRepo.getAllJournals(db);
    const settings = await readAppSettings(db);
    const calendars = await calendarRepo.getAllCalendars(db);
    const calendarEvents = await calendarRepo.getAllEvents(db);
    const reminders = await calendarRepo.getAllReminders(db);
    const clears = await calendarRepo.getAllOccurrenceClears(db);
    const foodItems = await foodRepo.getAllFoodItems(db);
    const foodLog = await foodRepo.getAllFoodLog(db);
    const todos = await todoRepo.getAllTodos(db);

    // Reads skip rows that fail validation; a backup must not look complete when it is not.
    const read: [BackedUpTable, number][] = [
      ['elements', elements.length],
      ['dashboard_items', dashboard.length],
      ['events', events.length],
      ['day_notes', dayNotesRaw.length],
      ['journal_notebooks', journalNotebooks.length],
      ['daily_journals', dailyJournals.length],
      ['calendars', calendars.length],
      ['calendar_events', calendarEvents.length],
      ['calendar_reminders', reminders.length],
      ['calendar_occurrence_clears', clears.length],
      ['food_items', foodItems.length],
      ['food_log', foodLog.length],
      ['todos', todos.length],
    ];
    let skippedRows = 0;
    for (const [table, readCount] of read) {
      skippedRows += (await countRows(db, table)) - readCount;
    }

    const elementIds = new Set(elements.map((element) => element.id));
    const dayNotes = dayNotesRaw.filter((note) => elementIds.has(note.elementId));

    const bundle = createProtocolBundle({
      elements,
      dashboard: dashboard.filter((item) => {
        const element = elements.find((candidate) => candidate.id === item.elementId);
        return element != null && element.archivedAt == null;
      }),
      events,
      dayNotes,
      dailyJournals,
      journalNotebooks,
      foodItems,
      foodLog,
      todos,
      settings,
      calendar: {
        schemaVersion: CALENDAR_BACKUP_VERSION,
        calendars,
        events: calendarEvents,
        reminders,
        clearedOccurrences: clears,
      },
    });
    return { bundle, skippedRows };
  });
}

export async function importProtocolBundle(raw: unknown): Promise<void> {
  const normalized = normalizeProtocolBundleInput(raw);
  const bundle = parseProtocolBundle(normalized);

  // The import replaces the events a running or paused session would be
  // banked into, so its seconds would be lost either way: say so instead.
  if (Object.keys(useEventStore.getState().activeTimerSessions).length > 0) {
    throw new Error(i18n.t('settings:data.importTimerRunning'));
  }

  await stopHabitSound();
  bumpDataGeneration('protocol');
  await awaitPendingEventWrites();
  useEventStore.setState({ activeTimerSessions: {} });

  await withDbWriteLock(async () => {
    // An import replaces the whole device, so every scope is invalidated.
    bumpAllDataGenerations();

    const db = await getDatabase();
    // Outside the transaction: SQLite's backup refuses a connection mid-write.
    await takeSafetyCopy(db, 'import');

    await db.withTransactionAsync(async () => {
      await clearDataForImport(db, (key) => bundle[key] !== undefined);

      for (const element of bundle.elements) {
        await elementRepo.insertElement(db, element);
      }

      const activeElementIds = new Set(
        bundle.elements
          .filter((element) => element.archivedAt == null)
          .map((element) => element.id),
      );
      const placedElementIds = new Set<string>();
      let sortOrder = 0;
      for (const item of bundle.dashboard) {
        if (!activeElementIds.has(item.elementId)) continue;
        await dashboardRepo.insertDashboardItem(db, item);
        placedElementIds.add(item.elementId);
        sortOrder = Math.max(sortOrder, item.sortOrder + 1);
      }
      for (const element of bundle.elements) {
        if (element.archivedAt != null || placedElementIds.has(element.id)) continue;
        await dashboardRepo.insertDashboardItem(db, {
          id: newId(),
          elementId: element.id,
          sortOrder,
        });
        sortOrder += 1;
      }
      for (const event of bundle.events) {
        await eventRepo.insertEvent(db, event);
      }
      const elementIds = new Set(bundle.elements.map((element) => element.id));
      for (const note of bundle.dayNotes ?? []) {
        if (!elementIds.has(note.elementId)) continue;
        await dayNoteRepo.insertNote(db, note);
      }
      for (const notebook of bundle.journalNotebooks ?? []) {
        await journalNotebookRepo.insertNotebook(db, notebook);
      }
      if ((bundle.journalNotebooks ?? []).length === 0) {
        await journalNotebookRepo.ensureDefaultNotebook(db);
      }
      for (const journal of bundle.dailyJournals ?? []) {
        await dailyJournalRepo.insertJournal(db, journal);
      }
      for (const item of bundle.foodItems ?? []) {
        await foodRepo.insertFoodItem(db, item);
      }
      const foodIds = new Set((bundle.foodItems ?? []).map((item) => item.id));
      for (const entry of bundle.foodLog ?? []) {
        if (!foodIds.has(entry.foodId)) continue;
        await foodRepo.insertFoodLogEntry(db, entry);
      }
      for (const todo of bundle.todos ?? []) {
        await todoRepo.insertTodo(db, todo);
      }
      if (bundle.foodItems) {
        // The imported catalog is authoritative — do not re-seed starter foods
        // the user had deleted before taking this backup.
        await markSeedFoodsApplied(db);
      }
      await writeAppSettings(db, bundle.settings);

      if (bundle.calendar) {
        const calendarIds = new Set(bundle.calendar.calendars.map((c) => c.id));
        const events = bundle.calendar.events.filter((e) => calendarIds.has(e.calendarId));
        const eventIds = new Set(events.map((e) => e.id));
        const reminders = bundle.calendar.reminders.filter((r) => eventIds.has(r.eventId));
        const clearedOccurrences = (bundle.calendar.clearedOccurrences ?? []).filter((c) =>
          eventIds.has(c.eventId),
        );
        await calendarRepo.importCalendarData(db, {
          calendars: bundle.calendar.calendars,
          events,
          reminders,
          clearedOccurrences,
        });
      }

      await calendarRepo.ensureDefaultCalendar(db);
    });

    // Invalidate writers that captured the mid-import generation while waiting on this lock.
    bumpAllDataGenerations();
  });
}

export function serializeBundle(bundle: ProtocolBundle): string {
  return JSON.stringify(bundle, null, 2);
}
