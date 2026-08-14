const HISTORY_MAX = 20;

export type NoteChunkHistory = {
  items: string[];
  index: number;
};

export function createNoteChunkHistory(body: string): NoteChunkHistory {
  return { items: [body], index: 0 };
}

export function canUndoNoteChunk(history: NoteChunkHistory): boolean {
  return history.index > 0;
}

export function canRedoNoteChunk(history: NoteChunkHistory): boolean {
  return history.index < history.items.length - 1;
}

/** Record a saved body. Drops any redo tail. No-op when unchanged. */
export function recordNoteChunk(history: NoteChunkHistory, body: string): NoteChunkHistory {
  if (history.items[history.index] === body) return history;
  const items = history.items.slice(0, history.index + 1);
  items.push(body);
  if (items.length > HISTORY_MAX) items.shift();
  return { items, index: items.length - 1 };
}

export function undoNoteChunk(
  history: NoteChunkHistory,
): { history: NoteChunkHistory; body: string } | null {
  if (history.index <= 0) return null;
  const index = history.index - 1;
  const body = history.items[index];
  if (body == null) return null;
  return { body, history: { items: history.items, index } };
}

export function redoNoteChunk(
  history: NoteChunkHistory,
): { history: NoteChunkHistory; body: string } | null {
  if (history.index >= history.items.length - 1) return null;
  const index = history.index + 1;
  const body = history.items[index];
  if (body == null) return null;
  return { body, history: { items: history.items, index } };
}
