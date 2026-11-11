import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';
import * as settingsRepo from './settingsRepository';

export const WIDGET_ACTION_LOG_KEY = 'widget_action_log';

const WidgetActionLogEntrySchema = z.object({
  id: z.string(),
  /** When the tap happened, so old entries can be let go. */
  at: z.string(),
  outcome: z.enum(['applied', 'dropped']),
  reason: z.string().optional(),
});

export type WidgetActionLogEntry = z.infer<typeof WidgetActionLogEntrySchema>;

/** Long past any queue a crash could leave behind. */
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** Every widget action already handled, by id; an unreadable log reads as empty. */
export async function loadWidgetActionLog(
  db: SQLiteDatabase,
): Promise<Map<string, WidgetActionLogEntry>> {
  const raw = await settingsRepo.getSetting(db, WIDGET_ACTION_LOG_KEY);
  if (!raw) return new Map();
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return new Map();
  }
  const parsed = z.array(WidgetActionLogEntrySchema).safeParse(stored);
  return new Map(parsed.success ? parsed.data.map((entry) => [entry.id, entry]) : []);
}

export async function saveWidgetActionLog(
  db: SQLiteDatabase,
  log: ReadonlyMap<string, WidgetActionLogEntry>,
  nowMs = Date.now(),
): Promise<void> {
  const kept = [...log.values()].filter((entry) => nowMs - Date.parse(entry.at) < KEEP_MS);
  await settingsRepo.setSetting(db, WIDGET_ACTION_LOG_KEY, JSON.stringify(kept));
}
