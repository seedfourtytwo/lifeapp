import {
  canRedoNoteChunk,
  canUndoNoteChunk,
  createNoteChunkHistory,
  recordNoteChunk,
  redoNoteChunk,
  undoNoteChunk,
} from '../src/notes/noteChunkHistory';

describe('noteChunkHistory', () => {
  it('starts with no undo or redo', () => {
    const history = createNoteChunkHistory('Day start');
    expect(canUndoNoteChunk(history)).toBe(false);
    expect(canRedoNoteChunk(history)).toBe(false);
  });

  it('undoes and redoes saved chunks', () => {
    let history = createNoteChunkHistory('');
    history = recordNoteChunk(history, 'Morning');
    history = recordNoteChunk(history, 'Morning\n\nEvening');
    expect(canUndoNoteChunk(history)).toBe(true);

    const undone = undoNoteChunk(history);
    expect(undone?.body).toBe('Morning');
    expect(canRedoNoteChunk(undone!.history)).toBe(true);

    const redone = redoNoteChunk(undone!.history);
    expect(redone?.body).toBe('Morning\n\nEvening');
    expect(canRedoNoteChunk(redone!.history)).toBe(false);
  });

  it('drops the redo tail after a new chunk', () => {
    let history = createNoteChunkHistory('');
    history = recordNoteChunk(history, 'A');
    history = recordNoteChunk(history, 'A\nB');
    history = undoNoteChunk(history)!.history;
    expect(canRedoNoteChunk(history)).toBe(true);
    history = recordNoteChunk(history, 'A\nC');
    expect(canRedoNoteChunk(history)).toBe(false);
    expect(history.items[history.index]).toBe('A\nC');
  });

  it('ignores a duplicate record', () => {
    const history = recordNoteChunk(createNoteChunkHistory('A'), 'A');
    expect(history.index).toBe(0);
    expect(history.items).toEqual(['A']);
  });

  it('drops the oldest chunk past the cap', () => {
    let history = createNoteChunkHistory('0');
    for (let i = 1; i <= 20; i += 1) {
      history = recordNoteChunk(history, String(i));
    }
    expect(history.items).toHaveLength(20);
    expect(history.items[0]).toBe('1');
    expect(history.items[19]).toBe('20');
    expect(canUndoNoteChunk(history)).toBe(true);
  });
});
