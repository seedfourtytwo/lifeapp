import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './client';
import * as weatherRepo from './repositories/weatherRepository';
import * as calendarRepo from './repositories/calendarRepository';
import * as eventRepo from './repositories/eventRepository';
import {
  clearOptionsAreEmpty,
  resolveActivityDeleteBeforeDate,
  type ClearAppDataOptions,
} from './clearDataPlan';

export type { ActivityClearPeriod, ClearAppDataOptions } from './clearDataPlan';
export {
  DEFAULT_CLEAR_OPTIONS,
  clearOptionsAreEmpty,
  describeClearPlan,
  resolveActivityDeleteBeforeDate,
} from './clearDataPlan';

async function clearProtocolDefinitions(db: SQLiteDatabase): Promise<void> {
  // events + dashboard_items cascade from elements, but clear explicitly for clarity.
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

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (options.definitions) {
      await clearProtocolDefinitions(db);
    } else if (options.activityHistory) {
      const before = resolveActivityDeleteBeforeDate(options.activityPeriod);
      if (before == null) {
        await eventRepo.deleteAllEvents(db);
      } else {
        await eventRepo.deleteEventsBeforeDate(db, before);
      }
    }

    if (options.calendar) {
      await calendarRepo.clearCalendarData(db);
    }
    if (options.weather) {
      await weatherRepo.clearWeatherDaily(db);
    }
    if (options.preferences) {
      await clearAppSettings(db);
    }
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
