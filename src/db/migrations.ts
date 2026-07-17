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
import { ensureElementsSchema } from './schemaIntegrity';

const CURRENT_SCHEMA_VERSION = 8;
/** v7: empty hop so devices that skipped archived_at still advance; ensureElementsSchema repairs columns. */
/** v8: weather_daily snapshots for ambient Home weather + future habit correlation. */

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
};

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1',
  );

  if (!row) {
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', CURRENT_SCHEMA_VERSION);
    await ensureElementsSchema(db);
    return;
  }

  let version = row.version;
  while (version < CURRENT_SCHEMA_VERSION) {
    const next = version + 1;
    const migrate = MIGRATIONS[next];
    if (migrate) {
      await migrate(db);
    }
    version = next;
    await db.runAsync('UPDATE schema_version SET version = ?', version);
  }

  await ensureElementsSchema(db);
}
