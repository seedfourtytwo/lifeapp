import type { SQLiteDatabase } from 'expo-sqlite';
import { deleteLegacyHabitSoundFile } from '../audio/legacyHabitSoundCleanup';
import { isBundledHabitSoundId } from '../protocol/habitSoundCatalog';
import { newId } from '../utils/id';
import { buildLegacyHabitTimerSoundFromLibrary } from './migrations/habitSoundLegacy';
import { parseLegacySoundLibrary } from './migrations/legacySoundLibrary';
import * as dashboardRepo from './repositories/dashboardRepository';
import * as elementRepo from './repositories/elementRepository';
import * as settingsRepo from './repositories/settingsRepository';
import { SCHEMA_SQL } from './schema';
import {
  ensureCalendarSchema,
  ensureDailyJournalsSchema,
  ensureDayNotesSchema,
  ensureElementsSchema,
  ensureFoodSchema,
  ensureTodoSchema,
  ensureJournalNotebooksSchema,
  ensureNoteShareStateSchema,
  ensureSchemaIntegrity,
  ensureWeatherDailySchema,
} from './schemaIntegrity';

const CURRENT_SCHEMA_VERSION = 22;
/** v7: empty hop so devices that skipped archived_at still advance; ensureElementsSchema repairs columns. */
/** v8: weather_daily snapshots for ambient Home weather + future habit correlation. */
/** v9: weather_daily.precip_probability for rain-chance correlation. */
/** v10: ambient local calendars / events / reminders (not protocol kinds). */
/** v11: per-occurrence calendar clears (silence badge/alerts for one instance only). */
/** v12: destructive clean slate — drop unused columns; wipe local data. */
/** v13: per-tracker per-day notes (day_notes). */
/** v14: daily journals (daily_journals) — one general note per calendar day. */
/** v15: note_share_state — local last-shared fingerprint (Android share sheet). */
/** v16: journal notebooks + journal entries as a dated feed; share state keyed by entry id. */
/** v17: one journal document per notebook per day (merge fragments; unique notebook+date). */
/** v18: drop empty journal rows that still lit Home icons. */
/** v19: food catalog (food_items) + day log (food_log) — a protocol catalog, not an element kind. */
/** v20: food_items gains season / glycemic index / portions / diversity key.
 *  Its own version rather than an edit to v19: a device that already ran v19
 *  sits at the steady state, where SCHEMA_SQL's CREATE TABLE IF NOT EXISTS is a
 *  no-op and the repair pass is skipped — so the columns would never arrive. */
/** v21: todos. */
/** v22: a journal notebook day holds several chapters instead of one document.
 *  Rebuilds daily_journals without UNIQUE (notebook_id, date) — SQLite cannot
 *  drop a table constraint in place — and adds sort_order. Existing rows all
 *  survive; each notebook day's rows are numbered by created_at. */

interface HabitElementRow {
  id: string;
  name: string;
  config_json: string;
}

const MIGRATIONS: Record<number, (db: SQLiteDatabase) => Promise<void>> = {
  2: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },
  3: async (db) => {
    const [elements, dashboard] = await Promise.all([
      elementRepo.getAllElements(db),
      dashboardRepo.getDashboardItems(db),
    ]);
    const pinnedIds = new Set(dashboard.map((item) => item.elementId));
    let sortOrder = await dashboardRepo.getNextSortOrder(db);
    for (const element of elements) {
      if (pinnedIds.has(element.id)) continue;
      await dashboardRepo.insertDashboardItem(db, {
        id: newId(),
        elementId: element.id,
        sortOrder,
      });
      sortOrder += 1;
    }
  },
  4: async (db) => {
    const rawLibrary = await settingsRepo.getSetting(db, 'sound_library');
    const soundLibrary = rawLibrary ? parseLegacySoundLibrary(JSON.parse(rawLibrary)) : [];
    const soundsById = new Map(soundLibrary.map((sound) => [sound.id, sound]));

    const rows = await db.getAllAsync<HabitElementRow>(
      "SELECT id, name, config_json FROM elements WHERE kind = 'habit'",
    );

    for (const row of rows) {
      const config = JSON.parse(row.config_json) as {
        soundId?: string;
        timerSound?: unknown;
        [key: string]: unknown;
      };
      if (config.timerSound || !config.soundId) continue;

      const legacy = soundsById.get(config.soundId);
      const timerSound = legacy
        ? buildLegacyHabitTimerSoundFromLibrary({
            source: legacy.source,
            uri: legacy.uri,
            label: legacy.label,
          })
        : undefined;
      if (!timerSound) continue;

      const { soundId: _removed, ...rest } = config;
      await elementRepo.updateElement(
        db,
        row.id,
        { name: row.name, config: { ...rest, timerSound } },
        'habit',
      );
    }
  },
  5: async (db) => {
    const rows = await db.getAllAsync<HabitElementRow>(
      "SELECT id, name, config_json FROM elements WHERE kind = 'habit'",
    );

    for (const row of rows) {
      const config = JSON.parse(row.config_json) as {
        soundId?: string;
        timerSound?: { trackId?: string; localUri?: string };
        [key: string]: unknown;
      };
      const trackId = config.timerSound?.trackId?.trim();
      const hasPlayableSound = Boolean(trackId && isBundledHabitSoundId(trackId));
      const hasLegacySound = Boolean(config.timerSound && !hasPlayableSound);
      const hasDeprecatedSoundId = Boolean(config.soundId);

      if (!hasLegacySound && !hasDeprecatedSoundId) continue;

      if (config.timerSound?.localUri) {
        await deleteLegacyHabitSoundFile(config.timerSound.localUri);
      }

      const { timerSound: _timerSound, soundId: _soundId, ...rest } = config;
      await elementRepo.updateElement(
        db,
        row.id,
        { name: row.name, config: rest },
        'habit',
      );
    }

    await db.runAsync("DELETE FROM app_settings WHERE key = 'sound_library'");
  },
  6: async (db) => {
    await ensureElementsSchema(db);

    const dashboard = await dashboardRepo.getDashboardItems(db);
    const activeIds = new Set(dashboard.map((item) => item.elementId));
    const rows = await db.getAllAsync<{ id: string; archived_at: string | null }>(
      'SELECT id, archived_at FROM elements',
    );

    const archivedAt = new Date().toISOString();
    for (const row of rows) {
      if (row.archived_at != null || activeIds.has(row.id)) continue;
      await elementRepo.setElementArchivedAt(db, row.id, archivedAt);
    }
  },
  8: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS weather_daily (
        date TEXT PRIMARY KEY NOT NULL,
        temp_c REAL NOT NULL,
        temp_min_c REAL NOT NULL,
        temp_max_c REAL NOT NULL,
        weather_code INTEGER NOT NULL,
        condition TEXT NOT NULL,
        lat REAL,
        lon REAL,
        fetched_at TEXT NOT NULL
      );
    `);
  },
  9: async (db) => {
    await ensureWeatherDailySchema(db);
  },
  10: async (db) => {
    await ensureCalendarSchema(db);
  },
  11: async (db) => {
    await ensureCalendarSchema(db);
  },
  12: async (db) => {
    // Destructive clean schema: remove unused columns and start fresh.
    // User opted out of preserving on-device / backup continuity.
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS daily_journals;
      DROP TABLE IF EXISTS day_notes;
      DROP TABLE IF EXISTS events;
      DROP TABLE IF EXISTS dashboard_items;
      DROP TABLE IF EXISTS elements;
      DROP TABLE IF EXISTS calendar_occurrence_clears;
      DROP TABLE IF EXISTS calendar_reminders;
      DROP TABLE IF EXISTS calendar_events;
      DROP TABLE IF EXISTS calendars;
      DROP TABLE IF EXISTS weather_daily;
      DELETE FROM app_settings;
      PRAGMA foreign_keys = ON;
    `);
    await db.execAsync(SCHEMA_SQL);
  },
  13: async (db) => {
    await ensureDayNotesSchema(db);
  },
  14: async (db) => {
    await ensureDailyJournalsSchema(db);
  },
  15: async (db) => {
    await ensureNoteShareStateSchema(db);
  },
  16: async (db) => {
    await ensureJournalNotebooksSchema(db);
    await ensureDailyJournalsSchema(db);
    await ensureNoteShareStateSchema(db);
  },
  17: async (db) => {
    await ensureDailyJournalsSchema(db);
  },
  18: async (db) => {
    await db.runAsync(`DELETE FROM daily_journals WHERE trim(body) = ''`);
  },
  19: async (db) => {
    await ensureFoodSchema(db);
  },
  20: async (db) => {
    await ensureFoodSchema(db);
  },
  21: async (db) => {
    await ensureTodoSchema(db);
  },
  22: async (db) => {
    await ensureDailyJournalsSchema(db);
  },
};

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1',
  );

  if (!row) {
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
    await ensureSchemaIntegrity(db);
    return;
  }

  let version = row.version;
  const needsRepair = version < CURRENT_SCHEMA_VERSION;
  while (version < CURRENT_SCHEMA_VERSION) {
    const next = version + 1;
    const migrate = MIGRATIONS[next];
    if (migrate) {
      await migrate(db);
    }
    version = next;
    await db.runAsync('UPDATE schema_version SET version = ?', version);
  }

  // Steady-state boots already match CURRENT_SCHEMA_VERSION — skip PRAGMA/DDL repair.
  // Repair runs after applying migrations (and on first insert above).
  if (!needsRepair) {
    return;
  }

  await ensureSchemaIntegrity(db);
}
