import { isBundledHabitSoundId } from '../protocol/habitSoundCatalog';
import {
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  DEFAULT_JOURNAL_NOTEBOOK_NAME,
  PROTOCOL_VERSION,
} from '../protocol';
import { newId } from '../utils/id';
import { buildLegacyHabitTimerSoundFromLibrary } from './migrations/habitSoundLegacy';
import {
  parseLegacySoundLibrary,
  type LegacySoundAsset,
} from './migrations/legacySoundLibrary';

function migrateHabitConfig(
  config: Record<string, unknown>,
  soundsById: Map<string, LegacySoundAsset>,
): Record<string, unknown> {
  const next = { ...config };

  const trackId =
    typeof next.timerSound === 'object' &&
    next.timerSound !== null &&
    'trackId' in next.timerSound
      ? String((next.timerSound as { trackId?: string }).trackId ?? '').trim()
      : '';
  const hasPlayableSound = Boolean(trackId && isBundledHabitSoundId(trackId));

  if (
    next.timerSound &&
    typeof next.timerSound === 'object' &&
    !hasPlayableSound
  ) {
    delete next.timerSound;
  }

  const soundId = typeof next.soundId === 'string' ? next.soundId : undefined;
  if (!next.timerSound && soundId) {
    const legacy = soundsById.get(soundId);
    const timerSound = legacy
      ? buildLegacyHabitTimerSoundFromLibrary({
          source: legacy.source,
          uri: legacy.uri,
          label: legacy.label,
        })
      : undefined;
    if (timerSound?.trackId && isBundledHabitSoundId(timerSound.trackId)) {
      next.timerSound = timerSound;
    }
    delete next.soundId;
  } else if (soundId) {
    delete next.soundId;
  }

  return next;
}

function normalizeElement(
  raw: unknown,
  soundsById: Map<string, LegacySoundAsset>,
  activeElementIds: Set<string>,
  exportedAt: string,
  legacyTreatAllActive: boolean,
): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  const element = raw as Record<string, unknown>;
  const { category: _category, parentId: _parentId, ...rest } = element;
  const id = typeof rest.id === 'string' ? rest.id : '';
  // Legacy bundles lack archivedAt: dashboard membership means active.
  // Empty-dashboard legacy backups treat all elements as active (pre-archive model).
  const archivedAt =
    rest.archivedAt === undefined
      ? activeElementIds.has(id) || legacyTreatAllActive
        ? null
        : exportedAt
      : rest.archivedAt;

  const normalized = { ...rest, archivedAt } as Record<string, unknown>;

  if (normalized.kind !== 'habit' || !normalized.config || typeof normalized.config !== 'object') {
    return normalized;
  }

  return {
    ...normalized,
    config: migrateHabitConfig(normalized.config as Record<string, unknown>, soundsById),
  };
}

/** Strips removed protocol fields and migrates legacy sound references before Zod parse. */
export function normalizeProtocolBundleInput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  const bundle = raw as Record<string, unknown>;
  const soundLibrary = Array.isArray(bundle.soundLibrary)
    ? parseLegacySoundLibrary(bundle.soundLibrary)
    : [];
  const soundsById = new Map(soundLibrary.map((sound) => [sound.id, sound]));
  const exportedAt =
    typeof bundle.exportedAt === 'string' ? bundle.exportedAt : new Date().toISOString();
  const activeElementIds = new Set(
    Array.isArray(bundle.dashboard)
      ? bundle.dashboard
          .map((item) =>
            item && typeof item === 'object' && 'elementId' in item
              ? String((item as { elementId?: string }).elementId ?? '')
              : '',
          )
          .filter(Boolean)
      : [],
  );

  const elementList = Array.isArray(bundle.elements) ? bundle.elements : [];
  const legacyWithoutArchiveField =
    elementList.length > 0 &&
    elementList.every(
      (element) =>
        !element ||
        typeof element !== 'object' ||
        !('archivedAt' in (element as Record<string, unknown>)),
    );
  const legacyTreatAllActive = legacyWithoutArchiveField && activeElementIds.size === 0;

  const elements = Array.isArray(bundle.elements)
    ? bundle.elements.map((element) =>
        normalizeElement(
          element,
          soundsById,
          activeElementIds,
          exportedAt,
          legacyTreatAllActive,
        ),
      )
    : bundle.elements;

  const dashboard = Array.isArray(bundle.dashboard)
    ? bundle.dashboard.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const row = item as Record<string, unknown>;
        const { overrides: _overrides, ...dashRest } = row;
        return dashRest;
      })
    : bundle.dashboard;

  const { soundLibrary: _removed, ...rest } = bundle;
  return normalizeJournalNotebooksAndEntries({ ...rest, elements, dashboard });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

/** Older backups: one journal per date, no notebooks. Attach a default catalog. */
function normalizeJournalNotebooksAndEntries(
  bundle: Record<string, unknown>,
): Record<string, unknown> {
  const rawJournals = Array.isArray(bundle.dailyJournals) ? bundle.dailyJournals : null;
  const rawNotebooks = Array.isArray(bundle.journalNotebooks)
    ? bundle.journalNotebooks
    : null;

  if (!rawJournals && !rawNotebooks) return bundle;

  let notebooks = rawNotebooks ? [...rawNotebooks] : [];
  let defaultId = '';
  const firstNotebook = notebooks.find(
    (row) => isRecord(row) && typeof row.id === 'string' && row.id.length > 0,
  );
  if (isRecord(firstNotebook) && typeof firstNotebook.id === 'string') {
    defaultId = firstNotebook.id;
  } else {
    const now =
      typeof bundle.exportedAt === 'string' ? bundle.exportedAt : new Date().toISOString();
    defaultId = newId();
    notebooks = [
      {
        id: defaultId,
        name: DEFAULT_JOURNAL_NOTEBOOK_NAME,
        color: DEFAULT_JOURNAL_NOTEBOOK_COLOR,
        sortOrder: 0,
        createdAt: now,
        protocolVersion: PROTOCOL_VERSION,
      },
    ];
  }

  const dailyJournals = rawJournals
    ? orderDailyJournalChapters(
        rawJournals.map((row) => {
          if (!isRecord(row)) return row;
          const notebookId =
            typeof row.notebookId === 'string' && row.notebookId.length > 0
              ? row.notebookId
              : defaultId;
          const createdAt =
            typeof row.createdAt === 'string' && row.createdAt.length > 0
              ? row.createdAt
              : typeof row.updatedAt === 'string'
                ? row.updatedAt
                : new Date().toISOString();
          return { ...row, notebookId, createdAt };
        }),
      )
    : rawJournals;

  return {
    ...bundle,
    journalNotebooks: notebooks,
    ...(dailyJournals ? { dailyJournals } : {}),
  };
}

/**
 * Number each notebook day's chapters 0..n-1.
 *
 * This used to *merge* a day's rows into one body, because the app kept one
 * document per notebook day. Since v22 those rows are the day's chapters and
 * every one of them is user writing, so the job here is ordering, not folding.
 *
 * Legacy ambiguity, stated plainly: a bundle written before v22 can hold two
 * rows for one day either because the old import bug duplicated them or
 * because a pre-v17 device never got merged — and nothing in the data tells
 * the two apart. Keeping both is the recoverable mistake (the reader deletes a
 * chapter); merging is not (the text is concatenated and cannot be split
 * again), so both are kept.
 *
 * Ordering key is `(sortOrder, createdAt, id)`, and the numbering is dense, so
 * normalizing an already-normalized bundle is a fixed point.
 */
function orderDailyJournalChapters(rows: unknown[]): unknown[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  const passthrough: unknown[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.notebookId !== 'string' || typeof row.date !== 'string') {
      passthrough.push(row);
      continue;
    }
    const key = `${row.notebookId}:${row.date}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const ordered: unknown[] = [];
  for (const list of groups.values()) {
    list.sort(compareChapterRows);
    list.forEach((row, index) => {
      ordered.push({ ...row, sortOrder: index });
    });
  }
  return [...ordered, ...passthrough];
}

/** Total order over one day's rows: stated position, then age, then id. */
function compareChapterRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
  const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  const createdA = String(a.createdAt ?? '');
  const createdB = String(b.createdAt ?? '');
  if (createdA !== createdB) return createdA.localeCompare(createdB);
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}
