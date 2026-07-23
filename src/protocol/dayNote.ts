import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import type { ElementDefinition } from './element';

/**
 * Per-tracker annotation for a calendar day.
 * Intentionally mutable (upsert/delete) — unlike append-only events — so users can
 * revise notes without inventing a note-edit event stream.
 */

/**
 * Absolute max body length for day notes (and daily journals — keep in sync).
 * Editor UX only warns near this ceiling; see `notes/noteBodyLimits.ts`.
 */
export const DAY_NOTE_BODY_MAX_LENGTH = 128_000;

export const DayNoteSchema = z.object({
  id: z.string().uuid(),
  elementId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z
    .string()
    .min(1)
    .max(DAY_NOTE_BODY_MAX_LENGTH)
    .refine((value) => value.trim().length >= 1, {
      message: 'Note body cannot be only whitespace',
    }),
  updatedAt: z.string().datetime(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type DayNote = z.infer<typeof DayNoteSchema>;

export function validateBundleDayNoteLinks(
  elements: ElementDefinition[],
  dayNotes: DayNote[],
): void {
  const byId = new Set(elements.map((element) => element.id));
  const seenKeys = new Set<string>();

  for (const note of dayNotes) {
    if (!byId.has(note.elementId)) {
      throw new Error(`Day note ${note.id} references unknown element ${note.elementId}`);
    }
    const key = `${note.elementId}:${note.date}`;
    if (seenKeys.has(key)) {
      throw new Error(
        `Duplicate day note for element ${note.elementId} on ${note.date}`,
      );
    }
    seenKeys.add(key);
  }
}
