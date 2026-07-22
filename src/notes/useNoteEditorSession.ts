import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { loadNoteBody, saveNoteBody } from './noteSave';
import {
  noteEditorHeading,
  noteEditorLabel,
  type NoteEditorTarget,
} from './types';
import { noteEditorSessionKey } from './sessionKey';

export type NoteEditorSessionState = {
  target: NoteEditorTarget;
  date: string;
  initialBody: string;
};

type Options = {
  /** Called after a successful save. `body` is null when cleared. */
  onSaved?: (date: string, body: string | null, target: NoteEditorTarget) => void;
};

/**
 * Shared open/load/save session for tracker notes and daily journals.
 * Pair with NoteEditorHost for the sheet UI.
 */
export function useNoteEditorSession(options: Options = {}) {
  const onSavedRef = useRef(options.onSaved);
  onSavedRef.current = options.onSaved;

  const [session, setSession] = useState<NoteEditorSessionState | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const openGenerationRef = useRef(0);

  const openWithBody = useCallback(
    (target: NoteEditorTarget, date: string, initialBody: string) => {
      openGenerationRef.current += 1;
      setSession({ target, date, initialBody });
    },
    [],
  );

  const open = useCallback(
    async (target: NoteEditorTarget, date: string) => {
      const generation = ++openGenerationRef.current;
      const noun = target.kind === 'journal' ? 'journal' : 'note';
      try {
        const body = await loadNoteBody(target, date);
        if (generation !== openGenerationRef.current) return;
        // Set session directly — do not call openWithBody (that would bump generation again).
        setSession({ target, date, initialBody: body });
      } catch (error) {
        if (generation !== openGenerationRef.current) return;
        Alert.alert(
          `Could not open ${noun}`,
          error instanceof Error ? error.message : 'Something went wrong',
        );
      }
    },
    [],
  );

  const dismiss = useCallback(() => {
    if (savingRef.current) return;
    setSession(null);
  }, []);

  const save = useCallback(async (body: string) => {
    const current = sessionRef.current;
    if (!current || savingRef.current) return;
    const noun = current.target.kind === 'journal' ? 'journal' : 'note';
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await saveNoteBody(current.target, current.date, body);
      onSavedRef.current?.(current.date, saved, current.target);
      setSession(null);
    } catch (error) {
      Alert.alert(
        `Could not save ${noun}`,
        error instanceof Error ? error.message : 'Something went wrong. Try again.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  return {
    session,
    saving,
    open,
    openWithBody,
    dismiss,
    save,
    /** Props for DayNoteEditorSheet / NoteEditorHost */
    sheet: session
      ? {
          visible: true as const,
          date: session.date,
          sessionKey: noteEditorSessionKey(session.target, session.date),
          heading: noteEditorHeading(session.target),
          trackerName: noteEditorLabel(session.target),
          initialBody: session.initialBody,
          saving,
        }
      : {
          visible: false as const,
          date: null,
          sessionKey: null,
          heading: 'Note',
          trackerName: '',
          initialBody: '',
          saving: false,
        },
  };
}

export type NoteEditorSession = ReturnType<typeof useNoteEditorSession>;
