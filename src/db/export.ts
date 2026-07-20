import { createProtocolBundle, parseProtocolBundle } from '../protocol';
import type { ProtocolBundle } from '../protocol';
import { CALENDAR_BACKUP_VERSION } from '../calendar/types';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import * as calendarRepo from '../db/repositories/calendarRepository';
import { readAppSettings, writeAppSettings } from './appSettingsBackup';
import { clearDataForImport } from './resetAppData';
import { normalizeProtocolBundleInput } from './normalizeProtocolBundle';
import { withDbWriteLock } from './writeLock';
import { newId } from '../utils/id';
import { awaitPendingEventWrites, bumpEventDataEpoch, useEventStore } from '../store/eventStore';
import { bumpCalendarDataEpoch } from '../store/calendarStore';
import { bumpWeatherDataEpoch } from '../weather/weatherEpoch';
import { stopHabitSound } from '../audio/habitTimerSound';

export async function exportProtocolBundle(): Promise<ProtocolBundle> {
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
    const elements = await elementRepo.getAllElements(db);
    const dashboard = await dashboardRepo.getDashboardItems(db);
    const events = await eventRepo.getAllEvents(db);
    const settings = await readAppSettings(db);
    const calendars = await calendarRepo.getAllCalendars(db);
    const calendarEvents = await calendarRepo.getAllEvents(db);
    const reminders = await calendarRepo.getAllReminders(db);
    const clears = await calendarRepo.getAllOccurrenceClears(db);

    return createProtocolBundle({
      elements,
      dashboard: dashboard.filter((item) => {
        const element = elements.find((candidate) => candidate.id === item.elementId);
        return element != null && element.archivedAt == null;
      }),
      events,
      settings,
      calendar: {
        schemaVersion: CALENDAR_BACKUP_VERSION,
        calendars,
        events: calendarEvents,
        reminders,
        clearedOccurrences: clears,
      },
    });
  });
}

export async function importProtocolBundle(raw: unknown): Promise<void> {
  const normalized = normalizeProtocolBundleInput(raw);
  const bundle = parseProtocolBundle(normalized);

  await stopHabitSound();
  bumpEventDataEpoch();
  await awaitPendingEventWrites();
  useEventStore.setState({ activeTimerSessions: {} });

  await withDbWriteLock(async () => {
    // Invalidate writers that started after the pre-lock drain.
    bumpEventDataEpoch();
    bumpCalendarDataEpoch();
    bumpWeatherDataEpoch();

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await clearDataForImport(db);

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

    // Invalidate writers that captured the mid-import epoch while waiting on this lock.
    bumpEventDataEpoch();
    bumpCalendarDataEpoch();
    bumpWeatherDataEpoch();
  });
}

export function serializeBundle(bundle: ProtocolBundle): string {
  return JSON.stringify(bundle, null, 2);
}
