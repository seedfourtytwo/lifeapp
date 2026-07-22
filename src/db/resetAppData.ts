import type { SQLiteDatabase } from 'expo-sqlite';
import { stopHabitSound } from '../audio/habitTimerSound';
import { stopHabitTimerLockScreenTicker } from '../habits/habitTimerLockScreen';
import { WEATHER_FORECAST_CACHE_KEY } from '../weather/forecastCache';
import { getDatabase } from './client';
import * as weatherRepo from './repositories/weatherRepository';
import * as calendarRepo from './repositories/calendarRepository';
import * as eventRepo from './repositories/eventRepository';
import * as dayNoteRepo from './repositories/dayNoteRepository';
import * as dailyJournalRepo from './repositories/dailyJournalRepository';
import * as settingsRepo from './repositories/settingsRepository';
import { clearPersistedActiveTimerSessions, ACTIVE_TIMER_SESSIONS_KEY } from './repositories/activeTimerRepository';
import {
  clearOptionsAreEmpty,
  resolveActivityDeleteBeforeDate,
  type ClearAppDataOptions,
} from './clearDataPlan';
import { withDbWriteLock } from './writeLock';
import { awaitPendingEventWrites, bumpEventDataEpoch, useEventStore } from '../store/eventStore';
import { bumpCalendarDataEpoch } from '../store/calendarStore';
import { bumpWeatherDataEpoch } from '../weather/weatherEpoch';

export type { ActivityClearPeriod, ClearAppDataOptions } from './clearDataPlan';
export {
  DEFAULT_CLEAR_OPTIONS,
  clearOptionsAreEmpty,
  describeClearPlan,
  resolveActivityDeleteBeforeDate,
} from './clearDataPlan';

async function clearProtocolDefinitions(db: SQLiteDatabase): Promise<void> {
  // events + dashboard_items + day_notes cascade from elements, but clear explicitly for clarity.
  await db.runAsync('DELETE FROM daily_journals');
  await db.runAsync('DELETE FROM day_notes');
  await db.runAsync('DELETE FROM events');
  await db.runAsync('DELETE FROM dashboard_items');
  await db.runAsync('DELETE FROM elements');
}

async function clearProtocolTables(db: SQLiteDatabase): Promise<void> {
  await clearProtocolDefinitions(db);
}

export async function clearAppSettings(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM app_settings');
}

/**
 * Selectively wipe local data.
 * Definitions always wipe all activity (cascade). Period filters apply only when
 * clearing activity without removing element definitions.
 */
export async function clearAppData(options: ClearAppDataOptions): Promise<void> {
  if (clearOptionsAreEmpty(options)) {
    throw new Error('Select at least one data type to clear');
  }

  // Validate period before opening a transaction.
  if (options.activityHistory && !options.definitions) {
    resolveActivityDeleteBeforeDate(options.activityPeriod);
  }

  const touchesActivity = options.definitions || options.activityHistory;
  const touchesSettings = options.preferences;
  const touchesEventEpoch = touchesActivity || touchesSettings;

  // Invalidate + drain outside the lock so in-flight event writers (which take
  // the same lock) can finish or abort without deadlocking against this clear.
  // Only bump the event epoch when activity/definitions/preferences are cleared —
  // weather/calendar-only clears must not drop in-flight counter/habit writes.
  if (touchesEventEpoch) {
    bumpEventDataEpoch();
  }
  if (touchesActivity) {
    stopHabitTimerLockScreenTicker();
    await stopHabitSound();
    await awaitPendingEventWrites();
    useEventStore.setState({ activeTimerSessions: {} });
    await clearPersistedActiveTimerSessions();
  }
  if (options.calendar) {
    bumpCalendarDataEpoch();
  }
  if (options.weather) {
    bumpWeatherDataEpoch();
  }

  await withDbWriteLock(async () => {
    // Invalidate anyone who queued after the drain above.
    if (touchesEventEpoch) bumpEventDataEpoch();
    if (options.calendar) bumpCalendarDataEpoch();
    if (options.weather) bumpWeatherDataEpoch();

    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      if (options.definitions) {
        await clearProtocolDefinitions(db);
      } else if (options.activityHistory) {
        const before = resolveActivityDeleteBeforeDate(options.activityPeriod);
        if (before == null) {
          await eventRepo.deleteAllEvents(db);
          await dayNoteRepo.deleteAllNotes(db);
          await dailyJournalRepo.deleteAllJournals(db);
        } else {
          await eventRepo.deleteEventsBeforeDate(db, before);
          await dayNoteRepo.deleteNotesBeforeDate(db, before);
          await dailyJournalRepo.deleteJournalsBeforeDate(db, before);
        }
      }

      if (options.calendar) {
        await calendarRepo.clearCalendarData(db);
      }
      if (options.weather) {
        await weatherRepo.clearWeatherDaily(db);
        // Forecast JSON lives in app_settings; drop it even when prefs are kept.
        if (!options.preferences) {
          await settingsRepo.deleteSetting(db, WEATHER_FORECAST_CACHE_KEY);
        }
      }
      if (options.preferences) {
        const liveSessions = useEventStore.getState().activeTimerSessions;
        await clearAppSettings(db);
        // Preference wipe clears all app_settings rows; re-write ephemeral timer state
        // so a theme/settings clear does not orphan a running lock-screen session.
        if (Object.keys(liveSessions).length > 0) {
          await settingsRepo.setSetting(
            db,
            ACTIVE_TIMER_SESSIONS_KEY,
            JSON.stringify(liveSessions),
          );
        }
      }
    });

    // Invalidate writers that captured the mid-clear epoch while waiting on this lock.
    if (touchesEventEpoch) bumpEventDataEpoch();
    if (options.calendar) bumpCalendarDataEpoch();
    if (options.weather) bumpWeatherDataEpoch();
  });
}

/** Wipe all local app data — elements, events, dashboard, calendar, weather, preferences. */
export async function clearAllAppData(): Promise<void> {
  await clearAppData({
    activityHistory: true,
    activityPeriod: { kind: 'all' },
    calendar: true,
    weather: true,
    preferences: true,
    definitions: true,
  });
}

/** Replace protocol tables, calendar, and preferences before importing a backup bundle. */
export async function clearDataForImport(db: SQLiteDatabase): Promise<void> {
  await clearProtocolTables(db);
  await calendarRepo.clearCalendarData(db);
  await weatherRepo.clearWeatherDaily(db);
  await clearAppSettings(db);
}
