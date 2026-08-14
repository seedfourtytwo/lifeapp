import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { loadNoteBody, loadNoteShareFingerprint, markNoteShared, saveNoteBody } from './noteSave';
import { presentNoteShare } from './presentNoteShare';
import { noteShareFileName } from './noteShareFileName';
import {
  noteEditorKind,
  noteEditorLabel,
  noteEditorTitle,
  type NoteEditorTarget,
} from './types';
import { noteEditorSessionKey } from './sessionKey';

export type NoteEditorSessionState = {
  target: NoteEditorTarget;
  date: string;
  initialBody: string;
  sessionKey: string;
  /** Fingerprint of the last body handed to the system share sheet, if any. */
  shareFingerprint: string | null;
  /** Open the sheet and start mic dictation immediately. */
  autoStartDictation?: boolean;
};

type Options = {
  /** Called after a successful save. `body` is null when cleared. */
  onSaved?: (date: string, body: string | null, target: NoteEditorTarget) => void;
};

export type OpenNoteOptions = {
  /** Start microphone dictation as soon as the sheet is ready. */
  dictate?: boolean;
};

/**
 * Shared open/load/save session for tracker notes and daily journals.
 * Pair with NoteEditorHost for the sheet UI.
 */
export function useNoteEditorSession(options: Options = {}) {
  const { t } = useTranslation('common');
  const onSavedRef = useRef(options.onSaved);
  onSavedRef.current = options.onSaved;

  const [session, setSession] = useState<NoteEditorSessionState | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const persistTargetRef = useRef<{ target: NoteEditorTarget; date: string } | null>(
    null,
  );
  const openGenerationRef = useRef(0);

  const open = useCallback(
    async (target: NoteEditorTarget, date: string, openOptions?: OpenNoteOptions) => {
      const generation = ++openGenerationRef.current;
      const noun = t(
        target.kind === 'journal' ? 'note.journalNoun' : 'note.noteNoun',
      );
      const autoStartDictation = openOptions?.dictate === true;
      try {
        const body = await loadNoteBody(target, date);
        const shareFingerprint = await loadNoteShareFingerprint(target, date).catch(
          () => null,
        );
        if (generation !== openGenerationRef.current) return;
        persistTargetRef.current = { target, date };
        setSession({
          target,
          date,
          initialBody: body,
          sessionKey: noteEditorSessionKey(target, date),
          shareFingerprint,
          autoStartDictation,
        });
      } catch (error) {
        if (generation !== openGenerationRef.current) return;
        Alert.alert(
          t('note.couldNotOpenTitle', { noun }),
          error instanceof Error ? error.message : t('errors.somethingWentWrong'),
        );
      }
    },
    [t],
  );

  const dismiss = useCallback(() => {
    // Always close — X must work even if a persist/save is in flight.
    // Keep persistTargetRef so a hide-flush still writes the last note.
    openGenerationRef.current += 1;
    setSession(null);
  }, []);

  /** Write to SQLite without closing. Skip UI reload — concurrent SQLite crashes the app. */
  const persist = useCallback(async (body: string) => {
    const write = persistTargetRef.current;
    if (!write) return;
    const { target, date } = write;
    try {
      const saved = await saveNoteBody(target, date, body);
      if (saved && target.kind === 'journal') {
        const nextTarget = { ...target, entryId: saved.id };
        persistTargetRef.current = { target: nextTarget, date };
        if (sessionRef.current) {
          sessionRef.current = { ...sessionRef.current, target: nextTarget };
        }
      }
    } catch {
      // Explicit Save still retries; don't interrupt dictation.
    }
  }, []);

  const save = useCallback(async (body: string) => {
    const current = sessionRef.current;
    const write = persistTargetRef.current;
    if (!current || !write || savingRef.current) return;
    const noun = t(
      current.target.kind === 'journal' ? 'note.journalNoun' : 'note.noteNoun',
    );
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await saveNoteBody(write.target, write.date, body);
      const nextTarget =
        saved && write.target.kind === 'journal' && !write.target.entryId
          ? { ...write.target, entryId: saved.id }
          : write.target;
      onSavedRef.current?.(write.date, saved?.body ?? null, nextTarget);
      openGenerationRef.current += 1;
      setSession(null);
    } catch (error) {
      Alert.alert(
        t('note.couldNotSaveTitle', { noun }),
        error instanceof Error ? error.message : t('errors.somethingWentWrongRetry'),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [t]);

  const share = useCallback(
    async (body: string) => {
      const current = sessionRef.current;
      const write = persistTargetRef.current;
      const message = body.trim();
      if (!current || !write || savingRef.current || !message) return;
      const generation = openGenerationRef.current;
      const label = noteEditorLabel(write.target);
      const title = [noteEditorTitle(write.target), write.date]
        .filter(Boolean)
        .join(' · ');
      const fileName = noteShareFileName({
        kind: noteEditorKind(write.target),
        label: label || undefined,
        date: write.date,
        sharedAt: new Date(),
      });
      try {
        await presentNoteShare({ title, body: message, fileName });
        const fingerprint = await markNoteShared(write.target, write.date, message);
        if (generation !== openGenerationRef.current) return;
        setSession((s) => (s ? { ...s, shareFingerprint: fingerprint } : s));
      } catch (error) {
        if (generation !== openGenerationRef.current) return;
        Alert.alert(
          t('note.couldNotShareTitle'),
          error instanceof Error ? error.message : t('note.couldNotShareBody'),
        );
      }
    },
    [t],
  );

  return {
    session,
    saving,
    open,
    dismiss,
    persist,
    save,
    share,
    /** Props for NoteEditorSheet / NoteEditorHost */
    sheet: session
      ? {
          visible: true as const,
          date: session.date,
          sessionKey: session.sessionKey,
          heading: noteEditorTitle(session.target),
          kind: noteEditorKind(session.target),
          headingIcon:
            session.target.kind === 'journal'
              ? (session.target.icon ?? 'notebook-outline')
              : undefined,
          trackerName: '',
          initialBody: session.initialBody,
          shareFingerprint: session.shareFingerprint,
          autoStartDictation: session.autoStartDictation === true,
          saving,
        }
      : {
          visible: false as const,
          date: null,
          sessionKey: null,
          heading: t('note.noteHeading'),
          kind: 'note' as const,
          headingIcon: undefined,
          trackerName: '',
          initialBody: '',
          shareFingerprint: null,
          autoStartDictation: false,
          saving: false,
        },
  };
}

export type NoteEditorSession = ReturnType<typeof useNoteEditorSession>;
