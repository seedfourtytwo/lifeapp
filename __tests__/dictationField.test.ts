/**
 * The pure half of "dictate into this text field".
 *
 * Everything here is decided without React, a native module or a note: how a
 * finished take joins the text already in the field, which one-line notice the
 * field should be showing, and what the mic in the corner looks like right now.
 * The hook in `useDictationField` is just these three answers wired to the
 * controller, so this is where the edge cases are pinned down.
 */
import {
  NO_DICTATION_NOTICE,
  appendDictatedText,
  dictationMicIcon,
  dictationNoticeReducer,
} from '../src/dictation/dictationField';
import { livePreviewLength, livePreviewText } from '../src/dictation/livePreview';

describe('appendDictatedText — paragraph fields (notes, journals)', () => {
  it('starts the take on its own line and leaves room for the next one', () => {
    expect(appendDictatedText('', 'hello there', 100, 'paragraph')).toEqual({
      text: 'hello there\n',
      truncated: false,
    });
    expect(appendDictatedText('first\n', 'second', 100, 'paragraph')).toEqual({
      text: 'first\nsecond\n',
      truncated: false,
    });
  });

  it('reports truncation when the take does not fit', () => {
    const result = appendDictatedText('', 'abcdefghij klmnop', 12, 'paragraph');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(12);
  });
});

describe('appendDictatedText — single-line fields (a todo title)', () => {
  it('never introduces a newline', () => {
    const result = appendDictatedText('buy milk', 'and bread', 120, 'inline');
    expect(result).toEqual({ text: 'buy milk and bread', truncated: false });
  });

  it('is the whole value when the field was empty', () => {
    expect(appendDictatedText('', 'call the dentist', 120, 'inline')).toEqual({
      text: 'call the dentist',
      truncated: false,
    });
  });

  it('ignores a take that was only whitespace', () => {
    expect(appendDictatedText('buy milk', '   ', 120, 'inline')).toEqual({
      text: 'buy milk',
      truncated: false,
    });
  });

  it('trims the take and the trailing edge of what is already there', () => {
    expect(appendDictatedText('buy milk  ', '  and bread  ', 120, 'inline').text).toBe(
      'buy milk and bread',
    );
  });

  it('cuts at a word boundary when the take overflows, and says so', () => {
    const result = appendDictatedText('', 'alpha bravo charlie delta', 20, 'inline');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(20);
    expect(result.text).toBe('alpha bravo charlie');
  });

  it('hard-cuts rather than throwing away most of a long first word', () => {
    const result = appendDictatedText('', 'a supercalifragilistic', 12, 'inline');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(12);
    expect(result.text.length).toBeGreaterThan(6);
  });

  it('leaves a full field alone and still reports the overflow', () => {
    const result = appendDictatedText('0123456789', 'more', 10, 'inline');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(10);
  });
});

describe('dictationNoticeReducer', () => {
  const warn = { type: 'takeWarning', text: 'three minutes left' } as const;
  const limit = { type: 'takeLimit', text: 'hit the 15 minute cap' } as const;

  it('starts with nothing to say', () => {
    expect(NO_DICTATION_NOTICE).toEqual({ notice: null, keepThroughCommit: false });
  });

  it('clears whatever was on screen when the mic opens again', () => {
    const after = dictationNoticeReducer(
      dictationNoticeReducer(NO_DICTATION_NOTICE, warn),
      { type: 'sessionOpened' },
    );
    expect(after).toEqual(NO_DICTATION_NOTICE);
  });

  it('shows the take warning as a plain notice', () => {
    expect(dictationNoticeReducer(NO_DICTATION_NOTICE, warn).notice).toEqual({
      text: 'three minutes left',
      tone: 'notice',
    });
  });

  it('drops the warning once the take commits', () => {
    const warned = dictationNoticeReducer(NO_DICTATION_NOTICE, warn);
    const after = dictationNoticeReducer(warned, { type: 'committed', truncatedText: null });
    expect(after.notice).toBeNull();
  });

  it('keeps the take-limit notice through the commit it caused', () => {
    // The cap fires, the take is committed a beat later — the sentence telling
    // you where the text went must survive that commit or it never gets read.
    const limited = dictationNoticeReducer(NO_DICTATION_NOTICE, limit);
    const after = dictationNoticeReducer(limited, { type: 'committed', truncatedText: null });
    expect(after.notice).toEqual({ text: 'hit the 15 minute cap', tone: 'notice' });
  });

  it('replaces even a take-limit notice when the text had to be cut', () => {
    const limited = dictationNoticeReducer(NO_DICTATION_NOTICE, limit);
    const after = dictationNoticeReducer(limited, {
      type: 'committed',
      truncatedText: 'field is full',
    });
    expect(after).toEqual({
      notice: { text: 'field is full', tone: 'error' },
      keepThroughCommit: false,
    });
  });

  it('lets the caller clear the line — typing means the notice is stale', () => {
    const limited = dictationNoticeReducer(NO_DICTATION_NOTICE, limit);
    expect(dictationNoticeReducer(limited, { type: 'cleared' })).toEqual(NO_DICTATION_NOTICE);
  });
});

describe('livePreviewText', () => {
  // A single-line field has nowhere to italicise a tail, so it shows the take
  // as one string. What it shows has to be what the budget counted, or the
  // field silently overruns its own cap.
  it('reads the same length it is counted at', () => {
    for (const live of [
      { committed: 'call the', tail: 'dentist' },
      { committed: 'call the', tail: '' },
      { committed: '', tail: 'dentist' },
      { committed: '', tail: '' },
    ]) {
      expect(livePreviewText(live).length).toBe(livePreviewLength(live));
    }
  });

  it('joins the settled phrases and the current guess with one space', () => {
    expect(livePreviewText({ committed: 'call the', tail: 'dentist' })).toBe('call the dentist');
  });

  it('is empty when there is no take', () => {
    expect(livePreviewText(null)).toBe('');
  });
});

describe('dictationMicIcon', () => {
  const idle = {
    starting: false,
    sessionOpen: false,
    finishing: false,
    micDisabled: false,
  };

  it('offers to start when nothing is happening', () => {
    expect(dictationMicIcon(idle)).toEqual({
      icon: 'microphone-outline',
      action: 'start',
      disabled: false,
    });
  });

  it('is inert while the field will not take dictation', () => {
    expect(dictationMicIcon({ ...idle, micDisabled: true })).toEqual({
      icon: 'microphone-outline',
      action: 'start',
      disabled: true,
    });
  });

  it('is un-pressable while the engine is warming up', () => {
    const state = dictationMicIcon({ ...idle, starting: true });
    expect(state.disabled).toBe(true);
    expect(state.action).toBe('start');
  });

  it('becomes the way to finish once the mic is open', () => {
    expect(dictationMicIcon({ ...idle, sessionOpen: true })).toEqual({
      icon: 'check',
      action: 'finish',
      disabled: false,
    });
  });

  it('stays visible but inert while the last words are transcribed', () => {
    expect(dictationMicIcon({ ...idle, sessionOpen: true, finishing: true })).toEqual({
      icon: 'check',
      action: 'finish',
      disabled: true,
    });
  });
});
