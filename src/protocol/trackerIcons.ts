import { z } from 'zod';

/**
 * Curated Material Community Icons for tracker identity.
 * Grow this list over time — do not expose the full MCI catalog in the picker.
 */
export const TRACKER_ICON_IDS = [
  // Mind / calm
  'meditation',
  'spa',
  'om',
  'thought-bubble',
  'brain',
  'head-snowflake',
  // Health / body
  'pill',
  'bottle-tonic',
  'flask',
  'heart',
  'heart-pulse',
  'lungs',
  'weather-windy',
  'smoking-off',
  // Fitness
  'dumbbell',
  'arm-flex',
  'arm-flex-outline',
  'weight-lifter',
  'kettlebell',
  'yoga',
  'run',
  'walk',
  'bike',
  'human-handsup',
  // Learning
  'book-open-page-variant',
  'book-open-variant',
  'bookshelf',
  'notebook-outline',
  'school',
  'desk-lamp',
  'pencil',
  // Daily life
  'water',
  'coffee',
  'food-apple',
  'bed',
  'leaf',
  'fire',
  'star',
  'target',
  'timer',
  'check-circle',
  'candle',
] as const;

export type TrackerIconId = (typeof TRACKER_ICON_IDS)[number];

const TRACKER_ICON_ID_SET = new Set<string>(TRACKER_ICON_IDS);

export function isTrackerIconId(value: string): value is TrackerIconId {
  return TRACKER_ICON_ID_SET.has(value);
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
