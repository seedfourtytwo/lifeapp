import { z } from 'zod';

/**
 * Featured icons shown first in the picker (covers current habits/counters).
 * Keep this short — the rest is searchable in the scrollable grid.
 */
export const TRACKER_ICON_FEATURED_IDS = [
  'meditation',
  'pill',
  'push-up',
  'pull-up',
  'yoga',
  'lungs',
  'smoking-off',
  'book-open-variant',
  'school',
  'weight-lifter',
  'dumbbell',
  'timer',
] as const;

/**
 * Extra curated icons in the picker (not the full Material Community set).
 *
 * Every entry except the custom ids must be a real glyph name in the shipped
 * MaterialCommunityIcons font — a typo renders as a blank box, so
 * `__tests__/trackerIcons.test.ts` checks each one against the glyph map.
 */
export const TRACKER_ICON_MORE_IDS = [
  // Mind / body
  'spa',
  'brain',
  'heart',
  'heart-pulse',
  'weather-windy',
  'sleep',
  'hospital-box',
  'hands-pray',
  'human-handsup',
  // Fitness
  'arm-flex',
  'kettlebell',
  'run',
  'walk',
  'bike',
  'hiking',
  'soccer',
  'basketball',
  'tennis',
  'swim',
  'gymnastics',
  'stairs-up',
  'terrain',
  'carabiner',
  'rowing',
  'skateboarding',
  'boxing-glove',
  'karate',
  'dance-ballroom',
  'shoe-sneaker',
  // Self-care / grooming
  'face-woman-shimmer-outline',
  'face-man-shimmer-outline',
  'lotion-outline',
  'spray-bottle',
  'mirror',
  'razor-double-edge',
  'content-cut',
  'hair-dryer-outline',
  'toothbrush',
  'tooth-outline',
  'shower',
  'bathtub-outline',
  'hand-wash-outline',
  'lipstick',
  // Health
  'pill-multiple',
  'bottle-tonic-plus-outline',
  'needle',
  'stethoscope',
  'thermometer',
  'bandage',
  'scale-bathroom',
  // Daily
  'notebook-outline',
  'notebook-edit-outline',
  'water',
  'coffee',
  'tea-outline',
  'glass-wine',
  'beer-outline',
  'food-apple',
  'food',
  'pizza',
  'carrot',
  'silverware-fork-knife',
  'bed',
  'alarm',
  'weather-night',
  'leaf',
  'pine-tree',
  'target',
  'check-circle',
  'format-list-checks',
  // Work / home
  'home',
  'sofa',
  'laptop',
  'code-tags',
  'briefcase-outline',
  'lightbulb-outline',
  'pencil-outline',
  'calendar',
  'translate',
  'cellphone-off',
  'timer-sand',
  // Chores / garden / money
  'broom',
  'vacuum-outline',
  'washing-machine',
  'dishwasher',
  'iron-outline',
  'trash-can-outline',
  'chef-hat',
  'pot-steam-outline',
  'cart-outline',
  'piggy-bank-outline',
  'flower-outline',
  'sprout-outline',
  'watering-can-outline',
  'shovel',
  // Creative
  'music',
  'guitar-acoustic',
  'piano',
  'violin',
  'metronome',
  'microphone-variant',
  'headphones',
  'palette',
  'brush-variant',
  'camera',
  'movie-open-outline',
  'gamepad-variant',
  'chess-knight',
  // People / travel
  'account-group',
  'handshake-outline',
  'human-greeting-variant',
  'chat-outline',
  'paw',
  'dog',
  'cat',
  'airplane',
  'car',
  'map-marker',
  'phone',
  'gift-outline',
  'star-outline',
  'fire',
  'rocket-launch',
  'fish',
] as const;

/** Local SVG stickmen — not Material Community Icon glyph names. */
export const CUSTOM_TRACKER_ICON_IDS = ['push-up', 'pull-up'] as const;

export type CustomTrackerIconId = (typeof CUSTOM_TRACKER_ICON_IDS)[number];

/**
 * Full allowlist for protocol validation.
 * Custom ids (`push-up`, `pull-up`) are drawn as local SVGs, not MCI glyphs.
 */
export const TRACKER_ICON_IDS = [
  ...TRACKER_ICON_FEATURED_IDS,
  ...TRACKER_ICON_MORE_IDS,
] as const;

export type TrackerIconId = (typeof TRACKER_ICON_IDS)[number];

const TRACKER_ICON_ID_SET = new Set<string>(TRACKER_ICON_IDS);
const TRACKER_ICON_FEATURED_SET = new Set<string>(TRACKER_ICON_FEATURED_IDS);
const CUSTOM_TRACKER_ICON_ID_SET = new Set<string>(CUSTOM_TRACKER_ICON_IDS);

export function isTrackerIconId(value: string): value is TrackerIconId {
  return TRACKER_ICON_ID_SET.has(value);
}

export function isFeaturedTrackerIconId(value: string): boolean {
  return TRACKER_ICON_FEATURED_SET.has(value);
}

export function isCustomTrackerIconId(value: string): value is CustomTrackerIconId {
  return CUSTOM_TRACKER_ICON_ID_SET.has(value);
}

/** Filter picker glyphs by slug (`push-up`) or spaced words (`push up`). */
export function iconIdMatchesQuery(id: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const compact = q.replace(/\s+/g, '-');
  const hay = id.toLowerCase();
  return hay.includes(compact) || hay.replace(/-/g, ' ').includes(q);
}

/** Strict id for writes / picker selection. */
export const TrackerIconIdSchema = z.enum(TRACKER_ICON_IDS);

/**
 * Optional config field: unknown / retired glyph names become undefined so old
 * or hand-edited backups do not break HabitConfigSchema / CounterConfigSchema.parse.
 */
export const OptionalTrackerIconSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value): TrackerIconId | undefined =>
    typeof value === 'string' && isTrackerIconId(value) ? value : undefined,
  );
