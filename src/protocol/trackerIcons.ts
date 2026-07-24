import { z } from 'zod';

/**
 * Featured icons shown first in the picker (covers current habits/counters).
 * Keep this short — full set expands via “More”.
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

/** Extra curated icons revealed when the user taps More. */
export const TRACKER_ICON_MORE_IDS = [
  // Mind / body
  'spa',
  'brain',
  'heart',
  'heart-pulse',
  'weather-windy',
  // Fitness
  'arm-flex',
  'kettlebell',
  'run',
  'walk',
  'bike',
  // Daily
  'notebook-outline',
  'water',
  'coffee',
  'food-apple',
  'bed',
  'leaf',
  'target',
  'check-circle',
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
