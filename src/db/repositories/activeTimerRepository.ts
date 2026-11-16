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

export async function clearWidgetTimerSessions(db: SQLiteDatabase): Promise<void> {
  await settingsRepo.deleteSetting(db, WIDGET_TIMER_SESSIONS_KEY);
}
