import type { SQLiteDatabase } from 'expo-sqlite';
import { ActiveTimerSessionSchema, type ActiveTimerSession } from '../../protocol';
import * as settingsRepo from './settingsRepository';

export const ACTIVE_TIMER_SESSIONS_KEY = 'active_timer_sessions';

/**
 * Each session is read on its own: one that no longer parses (an older build,
 * a clock that jumped) is dropped without taking the others with it.
 */
export async function loadPersistedActiveTimerSessions(
  db: SQLiteDatabase,
): Promise<Record<string, ActiveTimerSession>> {
  const raw = await settingsRepo.getSetting(db, ACTIVE_TIMER_SESSIONS_KEY);
  if (!raw) return {};

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};

  const sessions: Record<string, ActiveTimerSession> = {};
  for (const [id, value] of Object.entries(stored)) {
    const parsed = ActiveTimerSessionSchema.safeParse(value);
    if (parsed.success) {
      sessions[id] = parsed.data;
    } else {
      console.warn('Dropping unreadable saved timer session', id);
    }
  }
  return sessions;
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
