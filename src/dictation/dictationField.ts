/**
 * Dictating into a text field, decided without React.
 *
 * Three questions come up wherever a mic sits next to a text field, and none
 * of them need the engine, the screen or the note: where does a finished take
 * go, what single line of text is the field showing about dictation right now,
 * and what does the mic in the corner look like. `useDictationField` answers
 * them by calling into here, so the rules stay readable — and testable —
 * without reading a screen.
 */
import { appendTranscript } from '../utils/appendTranscript';

/**
 * How a committed take joins what is already in the field.
 * `paragraph` — its own line, like a note or a journal entry.
 * `inline` — one continuous line, like a todo title.
 */
export type DictationJoin = 'paragraph' | 'inline';

export type AppendedDictation = {
  text: string;
  /** The take did not fit; what is above is all that was kept. */
  truncated: boolean;
};

/** Prefer cutting at whitespace; fall back to a hard slice for one long word. */
function truncateAtBreak(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastBreak = slice.lastIndexOf(' ');
  if (lastBreak > maxLength * 0.6) {
    return slice.slice(0, lastBreak).trimEnd();
  }
  return slice.trimEnd();
}

/**
 * Append one committed take to the field, capped at `maxLength`.
 * Paragraph joining is delegated so notes and journals keep the exact shape
 * they have always been written in.
 */
export function appendDictatedText(
  existing: string,
  transcript: string,
  maxLength: number,
  join: DictationJoin = 'paragraph',
): AppendedDictation {
  if (join === 'paragraph') {
    return appendTranscript(existing, transcript, maxLength);
  }
  const next = transcript.trim();
  if (!next) return { text: existing, truncated: false };
  const base = existing.trimEnd();
  const joined = base ? `${base} ${next}` : next;
  if (joined.length <= maxLength) {
    return { text: joined, truncated: false };
  }
  return { text: truncateAtBreak(joined, maxLength), truncated: true };
}

export type DictationNoticeTone = 'error' | 'notice';

/** The one line a field shows about dictation — or nothing. */
export type DictationNotice = { text: string; tone: DictationNoticeTone } | null;

export type DictationNoticeState = {
  notice: DictationNotice;
  /**
   * A take-limit notice is raised *because* the take is about to commit, so
   * the commit that follows must not wipe it — that sentence is the only thing
   * telling you where your words went.
   */
  keepThroughCommit: boolean;
};

export const NO_DICTATION_NOTICE: DictationNoticeState = {
  notice: null,
  keepThroughCommit: false,
};

export type DictationNoticeEvent =
  | { type: 'sessionOpened' }
  | { type: 'takeWarning'; text: string }
  | { type: 'takeLimit'; text: string }
  /** `truncatedText` is the copy to show when the field could not hold it all. */
  | { type: 'committed'; truncatedText: string | null }
  | { type: 'cleared' };

export function dictationNoticeReducer(
  state: DictationNoticeState,
  event: DictationNoticeEvent,
): DictationNoticeState {
  switch (event.type) {
    case 'sessionOpened':
    case 'cleared':
      return NO_DICTATION_NOTICE;
    case 'takeWarning':
      return { notice: { text: event.text, tone: 'notice' }, keepThroughCommit: false };
    case 'takeLimit':
      return { notice: { text: event.text, tone: 'notice' }, keepThroughCommit: true };
    case 'committed':
      if (event.truncatedText) {
        return {
          notice: { text: event.truncatedText, tone: 'error' },
          keepThroughCommit: false,
        };
      }
      return state.keepThroughCommit ? state : NO_DICTATION_NOTICE;
  }
}

export type DictationMicAction = 'start' | 'finish';

export type DictationMicIcon = {
  /** Material Community icon name. */
  icon: string;
  action: DictationMicAction;
  disabled: boolean;
};

/**
 * One mic, three states: offer, wait, finish. A field mic has a single slot,
 * so the same control that opens the mic is the one that closes it.
 */
export function dictationMicIcon(field: {
  starting: boolean;
  sessionOpen: boolean;
  finishing: boolean;
  micDisabled: boolean;
}): DictationMicIcon {
  if (field.sessionOpen || field.finishing) {
    return { icon: 'check', action: 'finish', disabled: field.finishing };
  }
  if (field.starting) {
    return { icon: 'microphone', action: 'start', disabled: true };
  }
  return { icon: 'microphone-outline', action: 'start', disabled: field.micDisabled };
}
