import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { loadNoteBody, loadNoteShareFingerprint, markNoteShared, saveNoteBody } from './noteSave';
import { presentNoteShare } from './presentNoteShare';
import { noteShareFileName } from './noteShareFileName';
import {
  noteEditorHeading,
  noteEditorKind,
  noteEditorLabel,
  type NoteEditorTarget,
} from './types';
import { noteEditorSessionKey } from './sessionKey';

export type NoteEditorSessionState = {
  target: NoteEditorTarget;
  date: string;
  initialBody: string;
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
  const openGenerationRef = useRef(0);

  const open = useCallback(
    async (target: NoteEditorTarget, date: string, openOptions?: OpenNoteOptions) => {
      const generation = ++openGenerationRef.current;
      const noun = t(
        target.kind === 'journal' ? 'note.journalNoun' : 'note.noteNoun',
      );
      const autoStartDictation = openOptions?.dictate === true;
      try {
        const [body, shareFingerprint] = await Promise.all([
          loadNoteBody(target, date),
          loadNoteShareFingerprint(target, date).catch(() => null),
        ]);
        if (generation !== openGenerationRef.current) return;
        setSession({
          target,
          date,
          initialBody: body,
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
    if (savingRef.current) return;
    // Invalidate any in-flight open() so a late load cannot resurrect this sheet.
    openGenerationRef.current += 1;
    setSession(null);
  }, []);

  /** Write to SQLite without closing. Highlight still uses the body from when the sheet opened. */
  const persist = useCallback(async (body: string) => {
    const current = sessionRef.current;
    if (!current || savingRef.current) return;
    try {
      const saved = await saveNoteBody(current.target, current.date, body);
      if (saved == null) {
        setSession((s) =>
          s && s.shareFingerprint != null ? { ...s, shareFingerprint: null } : s,
        );
      }
      onSavedRef.current?.(current.date, saved, current.target);
    } catch {
      // Explicit Save still retries; don't interrupt dictation.
    }
  }, []);

  const save = useCallback(async (body: string) => {
    const current = sessionRef.current;
    if (!current || savingRef.current) return;
    const noun = t(
      current.target.kind === 'journal' ? 'note.journalNoun' : 'note.noteNoun',
    );
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await saveNoteBody(current.target, current.date, body);
      onSavedRef.current?.(current.date, saved, current.target);
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
      const message = body.trim();
      if (!current || savingRef.current || !message) return;
      const generation = openGenerationRef.current;
      const heading = noteEditorHeading(current.target);
      const label = noteEditorLabel(current.target);
      const title = [heading, label, current.date].filter(Boolean).join(' · ');
      const fileName = noteShareFileName({
        kind: noteEditorKind(current.target),
        label,
        date: current.date,
      });
      try {
        await presentNoteShare({ title, body: message, fileName });
        const fingerprint = await markNoteShared(current.target, current.date, message);
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
          sessionKey: noteEditorSessionKey(session.target, session.date),
          heading: noteEditorHeading(session.target),
          kind: noteEditorKind(session.target),
          trackerName: noteEditorLabel(session.target),
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
          trackerName: '',
          initialBody: '',
          shareFingerprint: null,
          autoStartDictation: false,
          saving: false,
        },
  };
}

export type NoteEditorSession = ReturnType<typeof useNoteEditorSession>;
