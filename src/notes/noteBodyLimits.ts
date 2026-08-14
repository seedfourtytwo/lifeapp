import { DAY_NOTE_BODY_MAX_LENGTH } from '../protocol';

/**
 * Note / journal body length UX thresholds.
 * Hard max is protocol `DAY_NOTE_BODY_MAX_LENGTH`. One dictation take is
 * smaller (`DICTATION_TAKE_MAX_CHARS`) so a long session can be split
 * across takes without blocking the JS thread.
 */

/** Absolute max — same as protocol Zod / repository checks. */
export const NOTE_BODY_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

export function clampNoteBody(text: string): string {
  return text.length <= NOTE_BODY_MAX_LENGTH
    ? text
    : text.slice(0, NOTE_BODY_MAX_LENGTH);
}

/** Show remaining/count UI when this many characters (or fewer) remain. */
export const NOTE_BODY_APPROACHING_REMAINING = 500;

/** Stronger warning when this many characters remain. */
export const NOTE_BODY_URGENT_REMAINING = 100;
