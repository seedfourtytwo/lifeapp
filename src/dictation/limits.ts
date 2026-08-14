/**
 * One dictation take = mic open until Done. No audio file is stored;
 * only the transcript is appended to the note.
 *
 * Keep these in sync with `LifeMoonshineDictationModule.kt`.
 * A note can be larger (`NOTE_BODY_MAX_LENGTH`); start a new take to continue.
 */
export const DICTATION_TAKE_MAX_CHARS = 24_000;

/** Wall-clock cap for one take (15 minutes). */
export const DICTATION_TAKE_MAX_MS = 15 * 60 * 1000;

/** Warn this long before the take is auto-finished. */
export const DICTATION_TAKE_WARN_MS = 12 * 60 * 1000;
