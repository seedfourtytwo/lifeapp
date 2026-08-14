import { noteEditorSessionKey } from '../src/notes/sessionKey';

describe('noteEditorSessionKey', () => {
  it('keys tracker notes by element and date', () => {
    expect(
      noteEditorSessionKey(
        { kind: 'tracker', elementId: 'a', label: 'Water' },
        '2025-01-02',
      ),
    ).toBe('tracker:a:2025-01-02');
  });

  it('keys a journal by notebook and date', () => {
    const date = '2025-01-02';
    expect(
      noteEditorSessionKey(
        { kind: 'journal', notebookId: 'nb', label: 'Ideas' },
        date,
      ),
    ).toBe('journal:nb:2025-01-02');
    expect(
      noteEditorSessionKey(
        {
          kind: 'journal',
          notebookId: 'nb',
          entryId: 'entry-1',
          label: 'Ideas',
        },
        date,
      ),
    ).toBe('journal:nb:2025-01-02');
  });

  it('differs for two trackers on the same day', () => {
    const date = '2025-01-02';
    const a = noteEditorSessionKey(
      { kind: 'tracker', elementId: 'a', label: 'A' },
      date,
    );
    const b = noteEditorSessionKey(
      { kind: 'tracker', elementId: 'b', label: 'B' },
      date,
    );
    expect(a).not.toBe(b);
  });
});
