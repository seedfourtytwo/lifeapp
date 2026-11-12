import { z } from 'zod';

/**
 * An urge: logged with one tap and never a question first, then ridden for a
 * fixed time. One the user does not resolve is ridden out once its ride has
 * ended; "used" is logged when he says so, with no comment either way.
 */

/** Ten minutes: the ride when no commitment sets another length. */
export const DEFAULT_RIDE_SECONDS = 600;

export const UrgeOutcomeSchema = z.enum(['rode_out', 'used']);
export type UrgeOutcome = z.infer<typeof UrgeOutcomeSchema>;

/** "What led to it?": one short line, kept with the urge and never shown on the lock screen. */
export const URGE_NOTE_MAX_LENGTH = 200;

/** A note as stored: on one line, trimmed, cut at the limit; null when nothing is left. */
export function normalizeUrgeNote(text: string): string | null {
  const line = text.replace(/\s+/g, ' ').trim().slice(0, URGE_NOTE_MAX_LENGTH).trim();
  return line === '' ? null : line;
}

export const UrgeSourceSchema = z.enum(['widget', 'app']);
export type UrgeSource = z.infer<typeof UrgeSourceSchema>;

export const UrgeSchema = z
  .object({
    id: z.string().uuid(),
    /** When it was logged. */
    at: z.string().datetime(),
    /** The app day it was logged on; it stays there whenever the ride ends. */
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Null while the ride is open. */
    outcome: UrgeOutcomeSchema.nullable(),
    /** When it was resolved: the ride's end for one ridden out. */
    resolvedAt: z.string().datetime().nullable(),
    source: UrgeSourceSchema,
    /** What led to it, if he said. Optional in backups made before notes existed. */
    note: z.string().min(1).max(URGE_NOTE_MAX_LENGTH).nullable().default(null),
  })
  .refine((urge) => (urge.outcome === null) === (urge.resolvedAt === null), {
    message: 'An urge has an outcome exactly when it has a resolved time',
  });

export type Urge = z.infer<typeof UrgeSchema>;
/** An urge as written: the note may be left out. */
export type UrgeInput = z.input<typeof UrgeSchema>;

export function rideEndsAt(urge: Pick<Urge, 'at'>, rideSeconds: number): Date {
  return new Date(Date.parse(urge.at) + rideSeconds * 1000);
}

/**
 * The open urges whose ride has ended by `now`, each resolved at its ride's
 * end. A ride ends at its end instant exactly. A clock moved back before an
 * urge leaves its ride running: its end is a fixed instant still to come.
 */
export function ridesEnded(
  urges: readonly Urge[],
  rideSeconds: number,
  now: Date,
): { id: string; resolvedAt: string }[] {
  return urges.flatMap((urge) => {
    if (urge.outcome !== null) return [];
    const end = rideEndsAt(urge, rideSeconds);
    return end.getTime() <= now.getTime() ? [{ id: urge.id, resolvedAt: end.toISOString() }] : [];
  });
}
