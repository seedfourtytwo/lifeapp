import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { clampNoteBody } from './noteBodyLimits';
import {
  canRedoNoteChunk,
  canUndoNoteChunk,
  createNoteChunkHistory,
  recordNoteChunk,
  redoNoteChunk,
  undoNoteChunk,
  type NoteChunkHistory,
} from './noteChunkHistory';

const PERSIST_DEBOUNCE_MS = 1600;

type Options = {
  visible: boolean;
  date: string | null;
  sessionKey: string | null;
  initialBody: string;
  onPersist?: (body: string) => void;
};

/**
 * Draft + saved-chunk history for the note sheet.
 * Persist timers bind to the open session; a session switch cancels a pending
 * debounce instead of writing the old draft onto the new target.
 */
export function useNoteEditorPersist({
  visible,
  date,
  sessionKey,
  initialBody,
  onPersist,
}: Options) {
  const [draft, setDraft] = useState(() => clampNoteBody(initialBody));
  const [fieldSeed, setFieldSeed] = useState(() => clampNoteBody(initialBody));
  const [fieldEpoch, setFieldEpoch] = useState(0);
  const [textEditing, setTextEditing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [persistedBody, setPersistedBody] = useState(() => clampNoteBody(initialBody));

  const seededSessionKeyRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const lastPersistedRef = useRef(clampNoteBody(initialBody));
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const historyRef = useRef<NoteChunkHistory>(createNoteChunkHistory(''));

  const cancelPersistTimer = () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  };

  const remountField = (text: string) => {
    const next = clampNoteBody(text);
    draftRef.current = next;
    setFieldSeed(next);
    setDraft(next);
    setFieldEpoch((n) => n + 1);
  };

  const persistDraft = (body: string, opts?: { recordHistory?: boolean }) => {
    const recordHistory = opts?.recordHistory !== false;
    if (recordHistory) {
      const nextHistory = recordNoteChunk(historyRef.current, body);
      if (nextHistory !== historyRef.current) {
        historyRef.current = nextHistory;
        setCanUndo(canUndoNoteChunk(nextHistory));
        setCanRedo(canRedoNoteChunk(nextHistory));
      }
    }
    if (body === lastPersistedRef.current) return;
    lastPersistedRef.current = body;
    setPersistedBody(body);
    onPersistRef.current?.(body);
  };

  const flushPendingPersist = () => {
    cancelPersistTimer();
    persistDraft(draftRef.current);
  };

  const applyHistoryBody = (body: string) => {
    setTextEditing(false);
    Keyboard.dismiss();
    remountField(body);
    persistDraft(body, { recordHistory: false });
  };

  const undoChunk = () => {
    flushPendingPersist();
    const result = undoNoteChunk(historyRef.current);
    if (!result) return;
    historyRef.current = result.history;
    setCanUndo(canUndoNoteChunk(result.history));
    setCanRedo(canRedoNoteChunk(result.history));
    applyHistoryBody(result.body);
  };

  const redoChunk = () => {
    flushPendingPersist();
    const result = redoNoteChunk(historyRef.current);
    if (!result) return;
    historyRef.current = result.history;
    setCanUndo(canUndoNoteChunk(result.history));
    setCanRedo(canRedoNoteChunk(result.history));
    applyHistoryBody(result.body);
  };

  const schedulePersist = () => {
    cancelPersistTimer();
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistDraft(draftRef.current);
    }, PERSIST_DEBOUNCE_MS);
  };

  const clearAll = () => {
    cancelPersistTimer();
    remountField('');
    historyRef.current = createNoteChunkHistory('');
    setCanUndo(false);
    setCanRedo(false);
    persistDraft('', { recordHistory: false });
  };

  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        if (seededSessionKeyRef.current) {
          cancelPersistTimer();
          persistDraft(draftRef.current);
        }
        seededSessionKeyRef.current = null;
        setTextEditing(false);
      }
      return;
    }
    if (seededSessionKeyRef.current === sessionKey) return;
    cancelPersistTimer();
    const body = clampNoteBody(initialBody);
    remountField(body);
    lastPersistedRef.current = body;
    setPersistedBody(body);
    setTextEditing(false);
    historyRef.current = createNoteChunkHistory(body);
    setCanUndo(false);
    setCanRedo(false);
    seededSessionKeyRef.current = sessionKey;
    Keyboard.dismiss();
  }, [visible, date, sessionKey, initialBody]);

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        onPersistRef.current?.(draftRef.current);
      }
    },
    [],
  );

  return {
    draft,
    setDraft,
    draftRef,
    fieldSeed,
    fieldEpoch,
    persistedBody,
    textEditing,
    setTextEditing,
    canUndo,
    canRedo,
    remountField,
    persistDraft,
    flushPendingPersist,
    schedulePersist,
    undoChunk,
    redoChunk,
    clearAll,
  };
}
