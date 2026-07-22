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

  it('keys journals by date', () => {
    expect(noteEditorSessionKey({ kind: 'journal' }, '2025-01-02')).toBe(
      'journal:2025-01-02',
    );
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
