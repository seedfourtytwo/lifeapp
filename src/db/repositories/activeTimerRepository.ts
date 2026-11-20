import { z } from 'zod';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  ActiveTimerSessionSchema,
  WidgetTimerSessionSchema,
  type ActiveTimerSession,
  type WidgetTimerSession,
} from '../../protocol';
import * as settingsRepo from './settingsRepository';

export const ACTIVE_TIMER_SESSIONS_KEY = 'active_timer_sessions';

const PersistedSessionsSchema = z.record(ActiveTimerSessionSchema);

export async function loadPersistedActiveTimerSessions(
  db: SQLiteDatabase,
): Promise<Record<string, ActiveTimerSession>> {
  const raw = await settingsRepo.getSetting(db, ACTIVE_TIMER_SESSIONS_KEY);
  if (!raw) return {};

  try {
    const parsed = PersistedSessionsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function persistActiveTimerSessions(
  db: SQLiteDatabase,
  sessions: Record<string, ActiveTimerSession>,
): Promise<void> {
  if (Object.keys(sessions).length === 0) {
    await settingsRepo.deleteSetting(db, ACTIVE_TIMER_SESSIONS_KEY);
    return;
  }
  await settingsRepo.setSetting(db, ACTIVE_TIMER_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function clearPersistedActiveTimerSessions(db: SQLiteDatabase): Promise<void> {
  await settingsRepo.deleteSetting(db, ACTIVE_TIMER_SESSIONS_KEY);
}

/**
 * Written by the Android widget only (WidgetDb.kt), in its own process. The app
 * never writes this key: it reads it, and removes it when activity is cleared.
 */
export const WIDGET_TIMER_SESSIONS_KEY = 'widget_timer_sessions';

const WidgetSessionsSchema = z.record(WidgetTimerSessionSchema);

export function parseWidgetTimerSessions(
  raw: string | null,
): Record<string, WidgetTimerSession> {
  if (!raw) return {};
  try {
    const parsed = WidgetSessionsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function loadWidgetTimerSessions(
  db: SQLiteDatabase,
): Promise<Record<string, WidgetTimerSession>> {
  return parseWidgetTimerSessions(await settingsRepo.getSetting(db, WIDGET_TIMER_SESSIONS_KEY));
}

/**
 * Written by the Android widget only (WidgetDb.kt): habit id → the `startedAt` of
 * the app session it took over. A timer the app has paused can be resumed or
 * stopped from the widget; the widget cannot edit the app's record (the app
 * rewrites it whole from memory), so it names here the session it took and the
 * app lets go of it the next time it looks.
 */
export const WIDGET_TAKEN_TIMERS_KEY = 'widget_taken_timers';

const WidgetTakenTimersSchema = z.record(z.string());

export function parseWidgetTakenTimers(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = WidgetTakenTimersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function loadWidgetTakenTimers(db: SQLiteDatabase): Promise<Record<string, string>> {
  return parseWidgetTakenTimers(await settingsRepo.getSetting(db, WIDGET_TAKEN_TIMERS_KEY));
}

/**
 * The app's sessions minus those the widget took. A session is matched on its
 * `startedAt`, so a new timer started later on the same habit is untouched.
 * `kept` is the same object when nothing was taken, so callers can skip a write.
 */
export function withoutTimersTakenByWidget(
  sessions: Record<string, ActiveTimerSession>,
  taken: Record<string, string>,
): { kept: Record<string, ActiveTimerSession>; released: string[] } {
  const released = Object.keys(sessions).filter((id) => taken[id] === sessions[id].startedAt);
  if (released.length === 0) return { kept: sessions, released };
  const kept = { ...sessions };
  for (const id of released) delete kept[id];
  return { kept, released };
}

/** The widget's stopwatches, and its record of the ones it took from the app. */
export async function clearWidgetTimerSessions(db: SQLiteDatabase): Promise<void> {
  await settingsRepo.deleteSetting(db, WIDGET_TIMER_SESSIONS_KEY);
  await settingsRepo.deleteSetting(db, WIDGET_TAKEN_TIMERS_KEY);
}
