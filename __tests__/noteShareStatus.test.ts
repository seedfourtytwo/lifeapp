import {
  canShowNoteShare,
  journalDayShareStatus,
  noteBodyFingerprint,
  noteShareActionColor,
  noteShareStatus,
} from '../src/notes/noteShareStatus';

describe('noteBodyFingerprint', () => {
  it('ignores surrounding whitespace', () => {
    expect(noteBodyFingerprint('hello')).toBe(noteBodyFingerprint('  hello\n'));
  });

  it('differs when the body changes', () => {
    expect(noteBodyFingerprint('walked')).not.toBe(noteBodyFingerprint('walked more'));
  });
});

describe('noteShareStatus', () => {
  const body = 'Today I ran';
  const other = 'Today I swam';
  const fp = noteBodyFingerprint(body);

  it('is never when nothing has been shared', () => {
    expect(
      noteShareStatus({ draft: body, persisted: body, lastSharedFingerprint: null }),
    ).toBe('never');
  });

  it('is never when the draft is empty even if a fingerprint remains', () => {
    expect(
      noteShareStatus({ draft: '  ', persisted: body, lastSharedFingerprint: fp }),
    ).toBe('never');
  });

  it('is current when draft, saved copy, and last share match', () => {
    expect(
      noteShareStatus({
        draft: body,
        persisted: `  ${body}\n`,
        lastSharedFingerprint: fp,
      }),
    ).toBe('current');
  });

  it('is stale when the draft changed after sharing', () => {
    expect(
      noteShareStatus({
        draft: other,
        persisted: other,
        lastSharedFingerprint: fp,
      }),
    ).toBe('stale');
  });

  it('is stale when shared but not yet saved', () => {
    expect(
      noteShareStatus({
        draft: body,
        persisted: '',
        lastSharedFingerprint: fp,
      }),
    ).toBe('stale');
  });
});

/**
 * One icon for a day made of several chapters.
 *
 * Each chapter carries its own last-shared fingerprint now, so the day's
 * colour is the roll-up: green only when nothing is left to send, grey only
 * when nothing has ever been sent, amber for everything in between — including
 * the case that used to be invisible, where one chapter went out and a second
 * was written afterwards.
 */
describe('journalDayShareStatus', () => {
  const one = 'Morning walk';
  const two = 'Evening read';
  const fpOne = noteBodyFingerprint(one);
  const fpTwo = noteBodyFingerprint(two);

  it('is never for a day nobody has shared', () => {
    expect(
      journalDayShareStatus([
        { draft: one, persisted: one, lastSharedFingerprint: null },
        { draft: two, persisted: two, lastSharedFingerprint: null },
      ]),
    ).toBe('never');
  });

  it('is never for a day with nothing written in it', () => {
    expect(
      journalDayShareStatus([{ draft: '  ', persisted: '', lastSharedFingerprint: null }]),
    ).toBe('never');
  });

  it('is current when every chapter is saved and matches what went out', () => {
    expect(
      journalDayShareStatus([
        { draft: one, persisted: one, lastSharedFingerprint: fpOne },
        { draft: two, persisted: two, lastSharedFingerprint: fpTwo },
      ]),
    ).toBe('current');
  });

  it('is stale when one chapter was shared and another never was', () => {
    expect(
      journalDayShareStatus([
        { draft: one, persisted: one, lastSharedFingerprint: fpOne },
        { draft: two, persisted: two, lastSharedFingerprint: null },
      ]),
    ).toBe('stale');
  });

  it('is stale when a shared chapter has been rewritten since', () => {
    expect(
      journalDayShareStatus([
        { draft: 'Morning walk, longer', persisted: 'Morning walk, longer', lastSharedFingerprint: fpOne },
        { draft: two, persisted: two, lastSharedFingerprint: fpTwo },
      ]),
    ).toBe('stale');
  });

  it('ignores a blank chapter so a fresh empty one does not go amber', () => {
    expect(
      journalDayShareStatus([
        { draft: one, persisted: one, lastSharedFingerprint: fpOne },
        { draft: '   ', persisted: '', lastSharedFingerprint: null },
      ]),
    ).toBe('current');
  });
});

describe('canShowNoteShare', () => {
  const ready = {
    hasDraftText: true,
    dictationBusy: false,
    shareAvailable: true,
  };

  it('shows when there is text, sharing works, and the mic is idle', () => {
    expect(canShowNoteShare(ready)).toBe(true);
  });

  it('hides during dictation', () => {
    expect(canShowNoteShare({ ...ready, dictationBusy: true })).toBe(false);
  });

  it('hides when the draft is empty', () => {
    expect(canShowNoteShare({ ...ready, hasDraftText: false })).toBe(false);
  });

  it('hides when the platform cannot share files', () => {
    expect(canShowNoteShare({ ...ready, shareAvailable: false })).toBe(false);
  });

  it('hides while Save is in flight', () => {
    expect(canShowNoteShare({ ...ready, saving: true })).toBe(false);
  });
});

describe('noteShareActionColor', () => {
  const palette = { current: 'green', stale: 'amber', idle: 'ink' };

  it('uses idle for never-shared so the control still looks tappable', () => {
    expect(noteShareActionColor('never', palette)).toBe('ink');
  });

  it('uses stale and current as status, not as disabled chrome', () => {
    expect(noteShareActionColor('stale', palette)).toBe('amber');
    expect(noteShareActionColor('current', palette)).toBe('green');
  });
});
