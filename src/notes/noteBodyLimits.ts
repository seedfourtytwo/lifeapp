import { DAY_NOTE_BODY_MAX_LENGTH } from '../protocol';

/**
 * Note / journal body length UX thresholds.
 * Hard max is protocol `DAY_NOTE_BODY_MAX_LENGTH` (Zod + DB). The editor always
 * allows up to that max and only surfaces warnings when remaining is low.
 */

/** Absolute max — same as protocol Zod / repository checks. */
export const NOTE_BODY_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

/** Show remaining/count UI when this many characters (or fewer) remain. */
export const NOTE_BODY_APPROACHING_REMAINING = 500;

/** Stronger warning when this many characters remain. */
export const NOTE_BODY_URGENT_REMAINING = 100;
