import { DAY_NOTE_BODY_MAX_LENGTH } from '../protocol';

export type AppendTranscriptResult = {
  text: string;
  truncated: boolean;
};

/** Join finalized speech segments from one dictation session. */
export function joinDictationParts(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

/** Prefer cutting at whitespace; fall back to a hard code-unit slice. */
function truncateNoteBody(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
  if (lastBreak > maxLength * 0.6) {
    return slice.slice(0, lastBreak).trimEnd();
  }
  return slice.trimEnd();
}

/**
 * Append a dictated phrase as its own paragraph.
 * Trailing newline so the next dictation (or typing) starts on a new line.
 * `maxLength` defaults to the protocol absolute max.
 */
export function appendTranscript(
  existing: string,
  transcript: string,
  maxLength: number = DAY_NOTE_BODY_MAX_LENGTH,
): AppendTranscriptResult {
  const next = transcript.trim();
  if (!next) return { text: existing, truncated: false };

  const trimmed = existing.trimEnd();
  const joined = trimmed ? `${trimmed}\n${next}\n` : `${next}\n`;
  if (joined.length <= maxLength) {
    return { text: joined, truncated: false };
  }
  return {
    text: truncateNoteBody(joined, maxLength),
    truncated: true,
  };
}

/**
 * Split unsaved additions from the last saved (or last committed baseline) body.
 * Returns null when there was no previous body, or the join can't be matched.
 */
export function splitAddedTake(
  prior: string,
  next: string,
): { base: string; added: string } | null {
  if (!prior.trim() || !next.trim()) return null;
  const base = prior.trimEnd();
  if (!next.startsWith(base)) return null;
  let added = next.slice(base.length);
  if (added.startsWith('\n')) {
    added = added.slice(1);
  }
  if (!added.trim()) return null;
  return { base: `${base}\n`, added };
}
