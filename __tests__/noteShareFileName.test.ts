import { noteShareFileName, noteShareFileNames } from '../src/notes/noteShareFileName';

describe('noteShareFileName', () => {
  it('names journals with the notebook slug and date', () => {
    expect(
      noteShareFileName({ kind: 'journal', label: 'Technical', date: '2026-08-14' }),
    ).toBe('technical-2026-08-14.txt');
  });

  it('falls back to journal when the notebook name is empty', () => {
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

  it('adds a serial only when a batch would collide', () => {
    expect(
      noteShareFileNames([
        { kind: 'journal', label: 'Ideas', date: '2026-08-14' },
        { kind: 'journal', label: 'Ideas', date: '2026-08-14' },
        { kind: 'journal', label: 'Sports', date: '2026-08-14' },
      ]),
    ).toEqual([
      'ideas-2026-08-14.txt',
      'ideas-2026-08-14-2.txt',
      'sports-2026-08-14.txt',
    ]);
  });

  it('leaves the name alone when the whole day goes out', () => {
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Technical',
        date: '2026-08-14',
        part: { chapters: [1, 2, 3], total: 3 },
      }),
    ).toBe('technical-2026-08-14.txt');
  });

  it('names the chapter when only one goes out', () => {
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Technical',
        date: '2026-08-14',
        part: { chapters: [2], total: 4 },
      }),
    ).toBe('technical-2026-08-14-ch2.txt');
  });

  it('counts them when a subset of several goes out', () => {
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Technical',
        date: '2026-08-14',
        part: { chapters: [1, 3], total: 4 },
      }),
    ).toBe('technical-2026-08-14-ch2of4.txt');
  });

  it('stamps the share time so a second tap is a new file', () => {
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Technical',
        date: '2026-08-14',
        sharedAt: new Date(2026, 7, 14, 17, 45, 12, 883),
      }),
    ).toBe('technical-2026-08-14-174512883.txt');
  });

  it('keeps the chapter marker in front of the share stamp', () => {
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Technical',
        date: '2026-08-14',
        part: { chapters: [3], total: 4 },
        sharedAt: new Date(2026, 7, 14, 17, 45, 12, 883),
      }),
    ).toBe('technical-2026-08-14-ch3-174512883.txt');
  });
});
