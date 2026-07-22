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
 */
export function appendTranscript(
  existing: string,
  transcript: string,
): AppendTranscriptResult {
  const next = transcript.trim();
  if (!next) return { text: existing, truncated: false };

  const trimmed = existing.trimEnd();
  const joined = trimmed ? `${trimmed}\n${next}\n` : `${next}\n`;
  if (joined.length <= DAY_NOTE_BODY_MAX_LENGTH) {
    return { text: joined, truncated: false };
  }
  return {
    text: truncateNoteBody(joined, DAY_NOTE_BODY_MAX_LENGTH),
    truncated: true,
  };
}
