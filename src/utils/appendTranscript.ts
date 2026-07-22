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

/** Append a dictated phrase into the note body with a single separating space. */
export function appendTranscript(
  existing: string,
  transcript: string,
): AppendTranscriptResult {
  const next = transcript.trim();
  if (!next) return { text: existing, truncated: false };

  const trimmed = existing.trimEnd();
  const joined = trimmed ? `${trimmed} ${next}` : next;
  if (joined.length <= DAY_NOTE_BODY_MAX_LENGTH) {
    return { text: joined, truncated: false };
  }
  return {
    text: joined.slice(0, DAY_NOTE_BODY_MAX_LENGTH),
    truncated: true,
  };
}
