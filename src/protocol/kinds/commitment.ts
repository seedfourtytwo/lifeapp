import { z } from 'zod';
import { DEFAULT_RIDE_SECONDS } from '../urge';
import type { ElementDefinition, HabitElement } from '../element';
import { normalizeLockScreenName } from './habit';

/**
 * A commitment: something kept by not doing it. Its day is done when it
 * holds no slip. A slip is an event (value 1, `source: 'slip'`), appended
 * and never removed, and moves `clearSince` to its moment; nothing else
 * (urges ridden out, lamps already passed) is touched by it.
 */

/** What a locked phone shows when no other neutral name was chosen. */
export const DEFAULT_COMMITMENT_LOCK_SCREEN_NAME = 'Clear';
export const OWN_LINES_MAX = 5;
export const OWN_LINE_MAX_LENGTH = 80;
export const INSTEAD_HABITS_MAX = 2;
export const RIDE_SECONDS_MIN = 60;
export const RIDE_SECONDS_MAX = 3600;

export const CommitmentConfigSchema = z.object({
  /** Always set: a commitment is shown on a locked phone by this name only. */
  lockScreenName: z
    .string()
    .optional()
    .transform((name) => normalizeLockScreenName(name) ?? DEFAULT_COMMITMENT_LOCK_SCREEN_NAME),
  /** The instant the time clear counts from: the start, or the latest slip. */
  clearSince: z.string().datetime(),
  /** Short lines in his own words; the one shown changes at each lamp. */
  ownLines: z
    .array(z.string().trim().min(1).max(OWN_LINE_MAX_LENGTH))
    .max(OWN_LINES_MAX)
    .default([]),
  /** Timed habits offered in place of the urge. A deleted one is left out when read. */
  insteadHabitIds: z
    .array(z.string().uuid())
    .max(INSTEAD_HABITS_MAX)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'An instead-habit is listed twice' })
    .default([]),
  /** How long an urge's ride lasts. */
  rideSeconds: z
    .number()
    .int()
    .min(RIDE_SECONDS_MIN)
    .max(RIDE_SECONDS_MAX)
    .default(DEFAULT_RIDE_SECONDS),
});

export type CommitmentConfig = z.infer<typeof CommitmentConfigSchema>;

export const CommitmentEventMetaSchema = z.object({ source: z.literal('slip') });

export type CommitmentInput = {
  name: string;
  lockScreenName?: string;
  ownLines: readonly string[];
  insteadHabitIds: readonly string[];
};

/** A new commitment's config, or an edited one keeping its clear-since and ride. */
export function buildCommitmentConfig(
  input: Omit<CommitmentInput, 'name'>,
  existing: Pick<CommitmentConfig, 'clearSince' | 'rideSeconds'>,
): CommitmentConfig {
  return CommitmentConfigSchema.parse({
    lockScreenName: input.lockScreenName,
    clearSince: existing.clearSince,
    ownLines: input.ownLines.map((line) => line.trim()).filter((line) => line !== ''),
    insteadHabitIds: input.insteadHabitIds,
    rideSeconds: existing.rideSeconds,
  });
}

const HOUR_MS = 3_600_000;
/** 24 h, 48 h, 3 d, 5 d, 7 d, 10 d, 14 d; then every 7 days. */
const FIXED_LAMP_HOURS = [24, 48, 72, 120, 168, 240, 336] as const;
const LAMP_EVERY_HOURS = 168;

/** The hour (after clear-since) of the lamp at `index`, counting from 0. */
export function lampHours(index: number): number {
  const fixed = FIXED_LAMP_HOURS[index];
  if (fixed !== undefined) return fixed;
  const last = FIXED_LAMP_HOURS[FIXED_LAMP_HOURS.length - 1]!;
  return last + LAMP_EVERY_HOURS * (index - FIXED_LAMP_HOURS.length + 1);
}

/** Lamps reached by `now`; a lamp is passed exactly at its hour. None before clear-since. */
export function lampsPassed(clearSince: string, now: Date): number {
  const elapsedHours = (now.getTime() - Date.parse(clearSince)) / HOUR_MS;
  const fixed = FIXED_LAMP_HOURS.filter((hours) => hours <= elapsedHours).length;
  if (fixed < FIXED_LAMP_HOURS.length) return fixed;
  const last = FIXED_LAMP_HOURS[FIXED_LAMP_HOURS.length - 1]!;
  return fixed + Math.floor((elapsedHours - last) / LAMP_EVERY_HOURS);
}

export interface NextLamp {
  at: Date;
  /** Hours after clear-since; what its label is made from. */
  hours: number;
}

export function nextLamp(clearSince: string, now: Date): NextLamp {
  const hours = lampHours(lampsPassed(clearSince, now));
  return { at: new Date(Date.parse(clearSince) + hours * HOUR_MS), hours };
}

/** The own line to show: one per lamp passed, round again after the last; null without lines. */
export function currentOwnLine(
  config: Pick<CommitmentConfig, 'ownLines' | 'clearSince'>,
  now: Date,
): string | null {
  if (config.ownLines.length === 0) return null;
  return config.ownLines[lampsPassed(config.clearSince, now) % config.ownLines.length] ?? null;
}

function isTimedHabitOnHome(element: ElementDefinition | undefined): element is HabitElement {
  return (
    element?.kind === 'habit' &&
    element.archivedAt == null &&
    element.config.trackingMode === 'timer'
  );
}

/** Why these ids cannot be saved as instead-habits, or null when they can. */
export function insteadHabitIdsProblem(
  ids: readonly string[],
  elements: readonly ElementDefinition[],
): 'missing' | 'not_a_timer' | null {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const id of ids) {
    const element = byId.get(id);
    if (!element || element.archivedAt != null) return 'missing';
    if (!isTimedHabitOnHome(element)) return 'not_a_timer';
  }
  return null;
}

/** The instead-habits that can still be started, in the order chosen. */
export function usableInsteadHabits(
  config: Pick<CommitmentConfig, 'insteadHabitIds'>,
  elements: readonly ElementDefinition[],
): HabitElement[] {
  const byId = new Map(elements.map((element) => [element.id, element]));
  return config.insteadHabitIds
    .map((id) => byId.get(id))
    .filter(isTimedHabitOnHome);
}
