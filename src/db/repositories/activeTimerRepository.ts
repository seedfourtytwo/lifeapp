import { z } from 'zod';
import { ActiveTimerSessionSchema, type ActiveTimerSession } from '../../protocol';
import { getDatabase } from '../client';
import * as settingsRepo from './settingsRepository';

export const ACTIVE_TIMER_SESSIONS_KEY = 'active_timer_sessions';

const PersistedSessionsSchema = z.record(ActiveTimerSessionSchema);

export async function loadPersistedActiveTimerSessions(): Promise<
  Record<string, ActiveTimerSession>
> {
  const db = await getDatabase();
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
  sessions: Record<string, ActiveTimerSession>,
): Promise<void> {
  const db = await getDatabase();
  if (Object.keys(sessions).length === 0) {
    await settingsRepo.deleteSetting(db, ACTIVE_TIMER_SESSIONS_KEY);
    return;
  }
  await settingsRepo.setSetting(db, ACTIVE_TIMER_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function clearPersistedActiveTimerSessions(): Promise<void> {
  const db = await getDatabase();
  await settingsRepo.deleteSetting(db, ACTIVE_TIMER_SESSIONS_KEY);
}
