import {
  CUSTOM_TRACKER_ICON_IDS,
  OptionalTrackerIconSchema,
  TRACKER_ICON_IDS,
  TRACKER_ICON_FEATURED_IDS,
  iconIdMatchesQuery,
  isCustomTrackerIconId,
  isFeaturedTrackerIconId,
  isTrackerIconId,
} from '../src/protocol/trackerIcons';
import { CounterConfigSchema } from '../src/protocol/kinds/counter';
import { HabitConfigSchema } from '../src/protocol/kinds/habit';
import { JournalNotebookSchema } from '../src/protocol/journalNotebook';
import { parseElementDefinition } from '../src/protocol/element';
// The glyph map that actually ships in the MaterialCommunityIcons font. A name
// missing from here renders as a blank box, so it is the source of truth.
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

describe('trackerIcons', () => {
  it('exposes a curated allowlist with a short featured set', () => {
    expect(TRACKER_ICON_FEATURED_IDS.length).toBeLessThanOrEqual(14);
    expect(TRACKER_ICON_IDS.length).toBeGreaterThan(TRACKER_ICON_FEATURED_IDS.length);
    expect(new Set(TRACKER_ICON_IDS).size).toBe(TRACKER_ICON_IDS.length);
    expect(isTrackerIconId('meditation')).toBe(true);
    expect(isTrackerIconId('push-up')).toBe(true);
    expect(isTrackerIconId('pull-up')).toBe(true);
    expect(isTrackerIconId('soccer')).toBe(true);
    expect(isTrackerIconId('laptop')).toBe(true);
    expect(isTrackerIconId('not-real')).toBe(false);
  });

  it('distinguishes featured vs custom ids', () => {
    expect(isFeaturedTrackerIconId('meditation')).toBe(true);
    expect(isFeaturedTrackerIconId('coffee')).toBe(false);
    expect(isCustomTrackerIconId('push-up')).toBe(true);
    expect(isCustomTrackerIconId('dumbbell')).toBe(false);
  });

  it('matches icon search against slugs and spaced words', () => {
    expect(iconIdMatchesQuery('push-up', '')).toBe(true);
    expect(iconIdMatchesQuery('push-up', 'push')).toBe(true);
    expect(iconIdMatchesQuery('push-up', 'push up')).toBe(true);
    expect(iconIdMatchesQuery('lightbulb-outline', 'light')).toBe(true);
    expect(iconIdMatchesQuery('coffee', 'zzz')).toBe(false);
  });

  it('only uses glyph names that exist in the shipped MaterialCommunityIcons font', () => {
    const custom = new Set<string>(CUSTOM_TRACKER_ICON_IDS);
    const missing = TRACKER_ICON_IDS.filter(
      (id) => !custom.has(id) && !(id in glyphMap),
    );
    expect(missing).toEqual([]);
  });

  it('draws every custom id with a local SVG rather than a glyph name', () => {
    for (const id of CUSTOM_TRACKER_ICON_IDS) {
      expect(isTrackerIconId(id)).toBe(true);
      expect(id in glyphMap).toBe(false);
    }
  });

  it('covers the activity gaps the curated set used to miss', () => {
    // Named gaps: acrobatics, yoga/stretching, face & skincare routines.
    const required = [
      // Acrobatics.
      'gymnastics',
      // Yoga / stretching, alongside the pre-existing yoga, meditation and spa.
      'human-handsup',
      'hands-pray',
      'yoga',
      'meditation',
      'spa',
      // Face and skincare, in full.
      'face-woman-shimmer-outline',
      'face-man-shimmer-outline',
      'lotion-outline',
      'toothbrush',
      'tooth-outline',
      'razor-double-edge',
      'content-cut',
      'hair-dryer-outline',
      'shower',
      'bathtub-outline',
      'spray-bottle',
      'mirror',
      'lipstick',
      'hand-wash-outline',
      // Other everyday trackers that had no icon at all.
      'boxing-glove',
      'karate',
      'dance-ballroom',
      'terrain',
      'stairs-up',
      'bandage',
      'pill-multiple',
      'scale-bathroom',
      'broom',
      'chef-hat',
      'watering-can-outline',
      'translate',
      'piano',
      'cellphone-off',
      'handshake-outline',
      'notebook-edit-outline',
      'alarm',
    ];
    const missing = required.filter((id) => !isTrackerIconId(id));
    expect(missing).toEqual([]);
  });

  it('does not carry a sports catalogue nobody here tracks', () => {
    // The curated set is for this app's actual use — habits, counters, body and
    // skincare routines, chores, food, study, music practice. Ball sports and
    // the trip-or-season activities were padding: a glyph you scroll past.
    const trimmed = [
      // Ball sports, named by the owner.
      'volleyball',
      'table-tennis',
      'badminton',
      'bowling',
      'hockey-sticks',
      'rugby',
      'baseball',
      'golf',
      // Need a venue or a season you cannot reach from home, so they are
      // holiday activities rather than something ticked off week to week.
      'horse',
      'kayaking',
      'surfing',
      'ski',
      'snowboard',
    ];
    const stillThere = trimmed.filter((id) => isTrackerIconId(id));
    expect(stillThere).toEqual([]);
  });

  it('keeps every id reachable from the picker search box', () => {
    // The grid is far taller than its 280px viewport now, so search — not
    // scrolling — is how an icon gets found. Typing the first word of an id
    // must surface it.
    for (const id of TRACKER_ICON_IDS) {
      const firstWord = id.split('-')[0];
      expect(iconIdMatchesQuery(id, firstWord)).toBe(true);
    }
  });
});

/**
 * Trimming the list must never cost anybody their data. A tracker or a notebook
 * saved when `golf` was on offer still says `golf` in SQLite and in every backup
 * file already written, so the id has to degrade to "no icon" — the tracker
 * keeps its name, schedule and history and simply loses its glyph. Anything that
 * throws here would take a whole restore down with it.
 */
describe('a retired icon id in existing data', () => {
  const RETIRED = 'golf';

  it('is no longer a known id', () => {
    expect(isTrackerIconId(RETIRED)).toBe(false);
  });

  it('degrades to no icon rather than throwing', () => {
    expect(OptionalTrackerIconSchema.parse(RETIRED)).toBeUndefined();
  });

  it('leaves a stored habit config intact apart from the glyph', () => {
    const config = HabitConfigSchema.parse({
      trackingMode: 'boolean',
      timeSlot: 'morning',
      schedule: { type: 'daily' },
      icon: RETIRED,
    });
    expect(config.icon).toBeUndefined();
    expect(config.timeSlot).toBe('morning');
  });

  it('leaves a stored counter config intact apart from the glyph', () => {
    const config = CounterConfigSchema.parse({
      unit: 'reps',
      quickIncrements: [1, 5],
      dailyTarget: 20,
      icon: RETIRED,
    });
    expect(config.icon).toBeUndefined();
    expect(config.dailyTarget).toBe(20);
  });

  it('leaves a journal notebook from an older backup importable', () => {
    const notebook = JournalNotebookSchema.parse({
      id: '3f1c9a2e-6d54-4a1b-9f0e-2c7d8b5a4e31',
      name: 'Practice',
      color: '#2563EB',
      icon: RETIRED,
      sortOrder: 0,
      createdAt: '2026-01-02T09:00:00.000Z',
      protocolVersion: 1,
    });
    expect(notebook.icon).toBeUndefined();
    expect(notebook.name).toBe('Practice');
  });

  it('lets a whole backup element parse instead of failing the import', () => {
    const element = parseElementDefinition({
      id: '9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d',
      kind: 'counter',
      name: 'Driving range',
      config: { unit: 'balls', quickIncrements: [10], icon: RETIRED },
      protocolVersion: 1,
      createdAt: '2026-01-02T09:00:00.000Z',
    });
    expect(element.name).toBe('Driving range');
  });
});
