import type { SQLiteDatabase } from 'expo-sqlite';
import type { ProtocolBundle } from '../protocol';
import { clearSeedFoodState } from '../nutrition/seedFoodState';
import * as calendarRepo from './repositories/calendarRepository';
import * as dailyJournalRepo from './repositories/dailyJournalRepository';
import * as dayNoteRepo from './repositories/dayNoteRepository';
import * as eventRepo from './repositories/eventRepository';
import * as foodRepo from './repositories/foodRepository';
import * as noteShareRepo from './repositories/noteShareStateRepository';
import * as todoRepo from './repositories/todoRepository';
import * as weatherRepo from './repositories/weatherRepository';
import {
  rebuildDailyJournals,
  rebuildNoteShareState,
  repairDailyJournals,
  repairDayNotes,
  repairElements,
  repairFoodItems,
  repairFoodLog,
  repairJournalNotebooks,
  repairWeatherDaily,
} from './schemaRepairs';

/**
 * Every persisted concept, declared once.
 *
 * Adding a table used to mean editing seven files in lockstep with nothing to
 * warn you about the one you missed — and migration v20 exists only because
 * that happened. The four cross-cutting consumers now read this list instead of
 * each keeping a hand-maintained copy:
 *
 *   - `schema.ts`         assembles SCHEMA_SQL from every `ddl`
 *   - `schemaIntegrity.ts` runs every `ddl` + `rebuild` + `repair`
 *   - `resetAppData.ts`   runs the `clear` stance the plan asks for
 *   - backup              declares its `bundleKey` (see the note on that field)
 *
 * The numbered migration ladder is deliberately NOT a consumer. Shipped
 * migrations are frozen and append-only: a device at the steady state skips the
 * repair pass entirely, so a migration that changes after it ran never runs
 * again and the change silently never arrives.
 */

/** A destructive step against one concept's tables. */
export type ClearStep = (db: SQLiteDatabase) => Promise<void>;

/** The same, bounded to rows before an exclusive `YYYY-MM-DD` cut-off. */
type DatedClearStep = (db: SQLiteDatabase, before: string) => Promise<void>;

/**
 * `'keep'` is a decision, not a default. Every concept states one for every
 * axis, so a new table cannot quietly opt out of being cleared.
 */
type ClearStance<TStep> = TStep | 'keep';

/** The user-facing toggles on the Clear data screen that wipe a whole concept. */
export type AmbientClearFlag = 'calendar' | 'weather' | 'preferences';

export interface ConceptClear {
  /** Wiping habit and counter definitions, which takes everything they own. */
  readonly definitions: ClearStance<ClearStep>;
  /** Wiping all activity history, definitions kept. */
  readonly activity: ClearStance<ClearStep>;
  /** Wiping activity older than a cut-off date. */
  readonly activityBefore: ClearStance<DatedClearStep>;
  /**
   * A backup import replaces the device rather than editing it, so it can take
   * more than a definitions clear does. Omitted means "same as `definitions`".
   */
  readonly onImport?: ClearStep;
  /** The ambient toggle that wipes this concept outright, if any. */
  readonly ambient?: { readonly flag: AmbientClearFlag; readonly wipe: ClearStep };
}

/** The payload keys of a backup bundle — `protocolVersion`/`exportedAt` are envelope, not data. */
type BundleDataKey = Exclude<keyof ProtocolBundle, 'protocolVersion' | 'exportedAt'>;

export interface PersistedConcept {
  /** Stable id — used by the driven tests and by the named repair wrappers. */
  readonly name: string;
  /** The tables this concept owns, parents before children. */
  readonly tables: readonly string[];
  /** CREATE TABLE + index DDL. The single source for both a fresh install and the repair pass. */
  readonly ddl: string;
  /** Repair that must run *before* the DDL, because CREATE TABLE IF NOT EXISTS would mask a stale shape. */
  readonly rebuild?: (db: SQLiteDatabase) => Promise<void>;
  /** Repair that runs *after* the DDL: added columns, seeds, orphan sweeps. */
  readonly repair?: (db: SQLiteDatabase) => Promise<void>;
  readonly clear: ConceptClear;
  /**
   * The bundle key this concept's rows travel under, or `null` when it is not
   * backed up at all. Typed against `ProtocolBundle`, so a key that does not
   * exist on the bundle fails to compile. Export and import keep their bespoke
   * ordering and link filtering — this field states *whether* a concept is in
   * the backup, which is the part that used to be forgotten.
   */
  readonly bundleKey: BundleDataKey | null;
}

/** Never cleared, never backed up: infrastructure. */
const NEVER_CLEARED: ConceptClear = {
  definitions: 'keep',
  activity: 'keep',
  activityBefore: 'keep',
};

/** Wiped only by its own ambient toggle (and by an import, which takes everything). */
function ambientOnly(flag: AmbientClearFlag, wipe: ClearStep): ConceptClear {
  return { ...NEVER_CLEARED, ambient: { flag, wipe } };
}

function deleteAllFrom(table: string): ClearStep {
  return async (db) => {
    await db.runAsync(`DELETE FROM ${table}`);
  };
}

/**
 * Declaration order is creation order: parents before children, so the DDL is
 * FK-safe as written and the reverse is a safe delete order.
 *
 * `as const satisfies` rather than a plain annotation: it keeps the type check
 * while narrowing `name` to literals, so `PersistedConceptName` is derived from
 * this one list and a table keyed by it cannot miss a concept. The exported
 * value is widened again, so consumers see the full `PersistedConcept` shape
 * (optional fields included) rather than each entry's narrowed literal type.
 */
const CONCEPT_LIST = [
  {
    name: 'schemaVersion',
    tables: ['schema_version'],
    ddl: `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);`,
    clear: NEVER_CLEARED,
    bundleKey: null,
  },
  {
    name: 'elements',
    tables: ['elements'],
    ddl: `
CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT
);`,
    repair: repairElements,
    clear: {
      definitions: deleteAllFrom('elements'),
      activity: 'keep',
      activityBefore: 'keep',
    },
    bundleKey: 'elements',
  },
  {
    name: 'dashboard',
    tables: ['dashboard_items'],
    ddl: `
CREATE TABLE IF NOT EXISTS dashboard_items (
  id TEXT PRIMARY KEY NOT NULL,
  element_id TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE
);`,
    clear: {
      definitions: deleteAllFrom('dashboard_items'),
      activity: 'keep',
      activityBefore: 'keep',
    },
    bundleKey: 'dashboard',
  },
  {
    name: 'events',
    tables: ['events'],
    ddl: `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  element_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  meta_json TEXT,
  protocol_version INTEGER NOT NULL,
  FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_element_date ON events(element_id, date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);`,
    clear: {
      definitions: deleteAllFrom('events'),
      activity: eventRepo.deleteAllEvents,
      activityBefore: eventRepo.deleteEventsBeforeDate,
    },
    bundleKey: 'events',
  },
  {
    name: 'dayNotes',
    tables: ['day_notes'],
    ddl: `
CREATE TABLE IF NOT EXISTS day_notes (
  id TEXT PRIMARY KEY NOT NULL,
  element_id TEXT NOT NULL,
  date TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE,
  UNIQUE (element_id, date)
);

CREATE INDEX IF NOT EXISTS idx_day_notes_element_date ON day_notes(element_id, date);`,
    repair: repairDayNotes,
    clear: {
      definitions: deleteAllFrom('day_notes'),
      activity: dayNoteRepo.deleteAllNotes,
      activityBefore: dayNoteRepo.deleteNotesBeforeDate,
    },
    bundleKey: 'dayNotes',
  },
  {
    name: 'journalNotebooks',
    tables: ['journal_notebooks'],
    ddl: `
CREATE TABLE IF NOT EXISTS journal_notebooks (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  protocol_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_notebooks_sort ON journal_notebooks(sort_order);`,
    repair: repairJournalNotebooks,
    clear: {
      definitions: deleteAllFrom('journal_notebooks'),
      // A notebook is a definition, not a day fact — clearing history empties it
      // but does not delete it.
      activity: 'keep',
      activityBefore: 'keep',
    },
    bundleKey: 'journalNotebooks',
  },
  {
    name: 'dailyJournals',
    tables: ['daily_journals'],
    // Do not create idx_daily_journals_notebook_date here: on a pre-v16 database
    // that column only exists after `rebuildDailyJournals`, and this DDL also runs
    // on every open. `repairDailyJournals` adds the unique index once it is safe.
    ddl: `
CREATE TABLE IF NOT EXISTS daily_journals (
  id TEXT PRIMARY KEY NOT NULL,
  notebook_id TEXT NOT NULL,
  date TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  -- No ON DELETE cascade on purpose: deleting a notebook must reassign its
  -- entries first (see journalNotebooks.ts deleteJournalNotebook). Silently
  -- cascading here would delete journal text; let the FK check fail loudly
  -- if a future code path deletes a notebook without reassigning.
  FOREIGN KEY (notebook_id) REFERENCES journal_notebooks(id),
  UNIQUE (notebook_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_journals_date ON daily_journals(date);`,
    rebuild: rebuildDailyJournals,
    repair: repairDailyJournals,
    clear: {
      definitions: deleteAllFrom('daily_journals'),
      activity: dailyJournalRepo.deleteAllJournals,
      activityBefore: dailyJournalRepo.deleteJournalsBeforeDate,
    },
    bundleKey: 'dailyJournals',
  },
  {
    name: 'foodItems',
    tables: ['food_items'],
    ddl: `
CREATE TABLE IF NOT EXISTS food_items (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  food_group TEXT NOT NULL,
  counts_as_plant INTEGER,
  diversity_key TEXT,
  aliases_json TEXT,
  season_months_json TEXT,
  peak_months_json TEXT,
  nutrients_json TEXT,
  glycemic_index REAL,
  portions_json TEXT,
  created_at TEXT NOT NULL,
  archived_at TEXT,
  protocol_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_items_group ON food_items(food_group);`,
    repair: repairFoodItems,
    clear: {
      definitions: async (db) => {
        await db.runAsync('DELETE FROM food_items');
        // Wiping the catalog also forgets the starter foods, so a clean slate
        // re-seeds instead of leaving an empty catalog with no way back.
        await clearSeedFoodState(db);
      },
      // The catalog is a definition; only the log below is day activity.
      activity: 'keep',
      activityBefore: 'keep',
    },
    bundleKey: 'foodItems',
  },
  {
    name: 'foodLog',
    tables: ['food_log'],
    ddl: `
CREATE TABLE IF NOT EXISTS food_log (
  id TEXT PRIMARY KEY NOT NULL,
  food_id TEXT NOT NULL,
  date TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  FOREIGN KEY (food_id) REFERENCES food_items(id) ON DELETE CASCADE,
  -- One row per food per day: v1 tracks "did I eat this", not how much.
  -- Adding amounts later means an additive nullable column on this row.
  UNIQUE (food_id, date)
);

CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(date);`,
    repair: repairFoodLog,
    clear: {
      definitions: deleteAllFrom('food_log'),
      activity: foodRepo.deleteAllFoodLog,
      activityBefore: foodRepo.deleteFoodLogBeforeDate,
    },
    bundleKey: 'foodLog',
  },
  {
    name: 'todos',
    tables: ['todos'],
    ddl: `
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  due_date TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  -- NULL = still open. Set = done, and that is the whole of "history":
  -- completed todos are never deleted, only filtered out of the open list.
  completed_at TEXT,
  protocol_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);`,
    clear: {
      // Completed todos are the history page, so they go with the rest of the
      // activity — including when definitions are wiped. Open todos are pending
      // work, not history: they outlive habits and counters.
      definitions: todoRepo.deleteCompletedTodos,
      activity: todoRepo.deleteCompletedTodos,
      activityBefore: todoRepo.deleteCompletedTodosBeforeDate,
      // An import replaces the device, so open todos go too — otherwise the
      // imported list would arrive merged with whatever was already on this phone.
      onImport: todoRepo.deleteAllTodos,
    },
    bundleKey: 'todos',
  },
  {
    name: 'noteShareState',
    tables: ['note_share_state'],
    // Local share fingerprint for notes/journals — not protocol, not backed up.
    ddl: `
CREATE TABLE IF NOT EXISTS note_share_state (
  kind TEXT NOT NULL,
  element_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  date TEXT NOT NULL,
  body_fp TEXT NOT NULL,
  shared_at TEXT NOT NULL,
  PRIMARY KEY (kind, element_id, entry_id, date)
);`,
    rebuild: rebuildNoteShareState,
    clear: {
      definitions: noteShareRepo.deleteAllShareState,
      activity: noteShareRepo.deleteAllShareState,
      activityBefore: noteShareRepo.deleteShareStateBeforeDate,
    },
    bundleKey: null,
  },
  {
    name: 'appSettings',
    tables: ['app_settings'],
    ddl: `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`,
    clear: ambientOnly('preferences', deleteAllFrom('app_settings')),
    bundleKey: 'settings',
  },
  {
    name: 'weather',
    tables: ['weather_daily'],
    ddl: `
CREATE TABLE IF NOT EXISTS weather_daily (
  date TEXT PRIMARY KEY NOT NULL,
  temp_c REAL NOT NULL,
  temp_min_c REAL NOT NULL,
  temp_max_c REAL NOT NULL,
  weather_code INTEGER NOT NULL,
  condition TEXT NOT NULL,
  precip_probability INTEGER,
  lat REAL,
  lon REAL,
  fetched_at TEXT NOT NULL
);`,
    repair: repairWeatherDaily,
    clear: ambientOnly('weather', weatherRepo.clearWeatherDaily),
    // Re-fetched from the network, so a backup would only carry stale numbers.
    bundleKey: null,
  },
  {
    name: 'calendar',
    tables: [
      'calendars',
      'calendar_events',
      'calendar_reminders',
      'calendar_occurrence_clears',
    ],
    ddl: `
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY NOT NULL,
  calendar_id TEXT NOT NULL,
  uid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  notes TEXT,
  event_type TEXT NOT NULL,
  all_day INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  rrule TEXT,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar ON calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);

CREATE TABLE IF NOT EXISTS calendar_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  offset_minutes INTEGER NOT NULL,
  enabled INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event ON calendar_reminders(event_id);

CREATE TABLE IF NOT EXISTS calendar_occurrence_clears (
  occurrence_key TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_occurrence_clears_event ON calendar_occurrence_clears(event_id);`,
    clear: ambientOnly('calendar', calendarRepo.clearCalendarData),
    bundleKey: 'calendar',
  },
] as const satisfies readonly PersistedConcept[];

export type PersistedConceptName = (typeof CONCEPT_LIST)[number]['name'];

/**
 * Widened back to the full `PersistedConcept` shape so consumers see the
 * optional fields, but with `name` kept narrow so a table keyed by concept name
 * stays exhaustive.
 */
export const PERSISTED_CONCEPTS: readonly (PersistedConcept & {
  name: PersistedConceptName;
})[] = CONCEPT_LIST;

const BY_NAME = new Map<string, PersistedConcept>(
  PERSISTED_CONCEPTS.map((concept) => [concept.name, concept]),
);

/** Look a concept up by name. Throws rather than silently repairing nothing. */
export function persistedConcept(name: PersistedConceptName): PersistedConcept {
  const concept = BY_NAME.get(name);
  if (!concept) throw new Error(`Unknown persisted concept: ${name}`);
  return concept;
}

/**
 * The step a backup import runs for a concept, or null if an import leaves it
 * alone. An import replaces the device rather than editing it, so each concept
 * gets its most complete wipe: its `onImport` override, else its ambient wipe,
 * else its definitions stance.
 */
export function importClearStep(clear: ConceptClear): ClearStep | null {
  if (clear.onImport) return clear.onImport;
  if (clear.ambient) return clear.ambient.wipe;
  return clear.definitions === 'keep' ? null : clear.definitions;
}
