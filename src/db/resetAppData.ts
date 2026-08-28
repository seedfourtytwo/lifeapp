import type { SQLiteDatabase } from 'expo-sqlite';
import { stopHabitSound } from '../audio/habitTimerSound';
import { stopHabitTimerLockScreenTicker } from '../kinds/habit/habitTimerLockScreen';
import { WEATHER_FORECAST_CACHE_KEY } from '../weather/forecastCache';
import { getDatabase } from './client';
import { importClearStep, PERSISTED_CONCEPTS, type AmbientClearFlag } from './persistedConcepts';
import * as settingsRepo from './repositories/settingsRepository';
import { clearPersistedActiveTimerSessions, ACTIVE_TIMER_SESSIONS_KEY } from './repositories/activeTimerRepository';
import { clearCornerScore } from './repositories/cornerScoreRepository';
import {
  clearOptionsAreEmpty,
  resolveActivityDeleteBeforeDate,
  type ClearAppDataOptions,
} from './clearDataPlan';
import { bumpDataGeneration } from './dataGeneration';
import { withDbWriteLock } from './writeLock';
import { awaitPendingEventWrites, useEventStore } from '../store/eventStore';

export type { ActivityClearPeriod, ClearAppDataOptions } from './clearDataPlan';
export {
  DEFAULT_CLEAR_OPTIONS,
  clearOptionsAreEmpty,
  describeClearPlan,
  resolveActivityDeleteBeforeDate,
} from './clearDataPlan';

/**
 * Concepts are declared parents-first so their DDL is foreign-key safe, which
 * makes the reverse a safe delete order: children before the rows they
 * reference. Every clear below walks this list and runs whatever stance the
 * concept declared, so a new table is cleared the moment it is declared.
 */
const CLEAR_ORDER = [...PERSISTED_CONCEPTS].reverse();

/** Habits, counters and everything they own. */
async function clearDefinitions(db: SQLiteDatabase): Promise<void> {
  for (const { clear } of CLEAR_ORDER) {
    if (clear.definitions === 'keep') continue;
    await clear.definitions(db);
  }
}

/** Day facts. `before` is an exclusive `YYYY-MM-DD` cut-off, or null for all of it. */
async function clearActivity(db: SQLiteDatabase, before: string | null): Promise<void> {
  for (const { clear } of CLEAR_ORDER) {
    if (before == null) {
      if (clear.activity === 'keep') continue;
      await clear.activity(db);
    } else {
      if (clear.activityBefore === 'keep') continue;
      await clear.activityBefore(db, before);
    }
  }
}

async function clearAmbient(db: SQLiteDatabase, flag: AmbientClearFlag): Promise<void> {
  for (const { clear } of CLEAR_ORDER) {
    if (clear.ambient?.flag !== flag) continue;
    await clear.ambient.wipe(db);
  }
}

/**
 * Invalidate in-flight writers for every scope this plan wipes. Scoped, not
 * global: a weather-only clear must not drop an unrelated counter or todo write.
 */
function bumpClearedScopes(options: ClearAppDataOptions): void {
  const touchesActivity = options.definitions || options.activityHistory;
  if (touchesActivity || options.preferences) bumpDataGeneration('protocol');
  if (touchesActivity) {
    bumpDataGeneration('catalog');
    bumpDataGeneration('todos');
    bumpDataGeneration('journal');
  }
  if (options.calendar) bumpDataGeneration('calendar');
  if (options.weather) bumpDataGeneration('weather');
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
  const touchesProtocolData = touchesActivity || touchesSettings;

  // Invalidate + drain outside the lock so in-flight event writers (which take
  // the same lock) can finish or abort without deadlocking against this clear.
  // Only bump the protocol scope when activity/definitions/preferences are cleared —
  // weather/calendar-only clears must not drop in-flight counter/habit writes.
  if (touchesProtocolData) {
    bumpDataGeneration('protocol');
  }
  if (touchesActivity) {
    // Catalog, todos and journals go with activity/definitions, so their
    // in-flight writers are invalidated alongside the event drain.
    bumpDataGeneration('catalog');
    bumpDataGeneration('todos');
    bumpDataGeneration('journal');
    stopHabitTimerLockScreenTicker();
    await stopHabitSound();
    await awaitPendingEventWrites();
    useEventStore.setState({ activeTimerSessions: {} });
    await clearPersistedActiveTimerSessions(await getDatabase());
  }
  if (options.calendar) {
    bumpDataGeneration('calendar');
  }
  if (options.weather) {
    bumpDataGeneration('weather');
  }

  await withDbWriteLock(async () => {
    // Invalidate anyone who queued after the drain above.
    bumpClearedScopes(options);

    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      if (options.definitions) {
        // Definitions always take all activity with them, so there is no period
        // to honour — each concept's definitions stance covers both.
        await clearDefinitions(db);
      } else if (options.activityHistory) {
        await clearActivity(db, resolveActivityDeleteBeforeDate(options.activityPeriod));
      }

      if (options.calendar) {
        await clearAmbient(db, 'calendar');
      }
      if (options.weather) {
        await clearAmbient(db, 'weather');
        // Forecast JSON + fun corner tally live in app_settings, so they belong
        // to weather rather than to the app_settings concept itself.
        if (!options.preferences) {
          await settingsRepo.deleteSetting(db, WEATHER_FORECAST_CACHE_KEY);
          await clearCornerScore(db);
        }
      }
      if (options.preferences) {
        const liveSessions = useEventStore.getState().activeTimerSessions;
        await clearAmbient(db, 'preferences');
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

    // Invalidate writers that captured the mid-clear generation while waiting on this lock.
    bumpClearedScopes(options);
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

/** Replace everything before importing a backup bundle. */
export async function clearDataForImport(db: SQLiteDatabase): Promise<void> {
  for (const { clear } of CLEAR_ORDER) {
    await importClearStep(clear)?.(db);
  }
}
