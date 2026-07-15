import { isBundledHabitSoundId } from '../protocol/habitSoundCatalog';
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
): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  const element = raw as Record<string, unknown>;
  const { category: _category, parentId: _parentId, ...rest } = element;
  const id = typeof rest.id === 'string' ? rest.id : '';
  // Legacy bundles lack archivedAt: dashboard membership means active.
  const archivedAt =
    rest.archivedAt === undefined
      ? activeElementIds.has(id)
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

  const elements = Array.isArray(bundle.elements)
    ? bundle.elements.map((element) =>
        normalizeElement(element, soundsById, activeElementIds, exportedAt),
      )
    : bundle.elements;

  const { soundLibrary: _removed, ...rest } = bundle;
  return { ...rest, elements };
}
