import {
  canShowNoteShare,
  noteBodyFingerprint,
  noteShareActionColor,
  noteShareStatus,
} from '../src/notes/noteShareStatus';
import { noteShareFileName } from '../src/notes/noteShareFileName';

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

describe('noteShareFileName', () => {
  it('names journals by date', () => {
    expect(noteShareFileName({ kind: 'journal', date: '2026-08-14' })).toBe(
      'journal-2026-08-14.txt',
    );
  });

  it('slugs tracker labels and strips accents', () => {
    expect(
      noteShareFileName({ kind: 'note', label: 'Méditation du soir', date: '2026-08-14' }),
    ).toBe('meditation-du-soir-2026-08-14.txt');
  });

  it('falls back when the tracker name is empty', () => {
    expect(noteShareFileName({ kind: 'note', label: '   ', date: '2026-08-14' })).toBe(
      'note-2026-08-14.txt',
    );
  });
});
