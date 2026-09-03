import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  deleteJournalChapter,
  loadJournalChapterShareFingerprints,
  loadJournalChapters,
  loadNoteBody,
  loadNoteShareFingerprint,
  markJournalChaptersShared,
  markNoteShared,
  saveNoteBody,
} from './noteSave';
import { presentNoteShare } from './presentNoteShare';
import { noteShareFileName, type NoteSharePart } from './noteShareFileName';
import {
  activeJournalChapterId,
  journalChapterIndex,
  type JournalChapter,
} from './journalChapters';
import { planJournalShare } from './journalShareSelection';
import {
  noteEditorKind,
  noteEditorLabel,
  noteEditorTitle,
  type NoteEditorTarget,
} from './types';
import { noteEditorSessionKey } from './sessionKey';
import { newId } from '../utils/id';

export type NoteEditorSessionState = {
  target: NoteEditorTarget;
  date: string;
  initialBody: string;
  sessionKey: string;
  /** Fingerprint of the last tracker day note handed to the share sheet, if any. */
  shareFingerprint: string | null;
  /**
   * Fingerprint of what each journal chapter last sent, by chapter id.
   *
   * One per chapter rather than one per day: the reader picks which chapters
   * go out, so only a per-chapter record can say whether what left is still
   * what that chapter says.
   */
  chapterShareFingerprints: Record<string, string>;
  /**
   * Every chapter this notebook holds for the day, first to last. Empty for a
   * tracker note, and for a journal day nobody has written in yet.
   */
  chapters: JournalChapter[];
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
 *
 * A journal target names one *chapter* of a notebook day (`target.entryId`).
 * Moving between chapters, starting one and deleting one all go through here
 * rather than the sheet, so the draft on screen is always written before the
 * next chapter is read — the sheet's own persist is fire-and-forget and would
 * race a reload.
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

  /** Read a target's body, chapters and share fingerprint, then show it. */
  const load = useCallback(
    async (
      target: NoteEditorTarget,
      date: string,
      openOptions?: OpenNoteOptions,
    ) => {
      const generation = ++openGenerationRef.current;
      const noun = t(
        target.kind === 'journal' ? 'note.journalNoun' : 'note.noteNoun',
      );
      const autoStartDictation = openOptions?.dictate === true;
      try {
        const body = await loadNoteBody(target, date);
        const chapters = await loadJournalChapters(target, date);
        const shareFingerprint = await loadNoteShareFingerprint(target, date).catch(
          () => null,
        );
        const chapterShareFingerprints = await loadJournalChapterShareFingerprints(
          target,
          date,
        ).catch(() => ({}));
        if (generation !== openGenerationRef.current) return;
        persistTargetRef.current = { target, date };
        setSession({
          target,
          date,
          initialBody: body,
          sessionKey: noteEditorSessionKey(target, date),
          shareFingerprint,
          chapterShareFingerprints,
          chapters,
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

  const open = load;

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

  /**
   * Write the chapter on screen, then reopen the sheet on `entryId`.
   *
   * `entryId` may name a chapter that does not exist yet — that is how a new
   * one starts: the id is minted here, the row appears on first save.
   */
  const openChapter = useCallback(
    async (entryId: string | undefined, body: string) => {
      const write = persistTargetRef.current;
      const current = sessionRef.current;
      if (!write || !current || write.target.kind !== 'journal') return;
      await persist(body);
      const next: NoteEditorTarget = { ...write.target, entryId };
      await load(next, write.date);
    },
    [load, persist],
  );

  const selectChapter = useCallback(
    async (entryId: string, body: string) => {
      if (persistTargetRef.current?.target.kind !== 'journal') return;
      if (persistTargetRef.current.target.entryId === entryId) return;
      await openChapter(entryId, body);
    },
    [openChapter],
  );

  const addChapter = useCallback(
    async (body: string) => {
      await openChapter(newId(), body);
    },
    [openChapter],
  );

  /**
   * Delete the chapter on screen and land on its neighbour — the one before it
   * where there is one, so deleting the last chapter does not jump to the top.
   */
  const removeChapter = useCallback(async () => {
    const write = persistTargetRef.current;
    const current = sessionRef.current;
    if (!write || !current || write.target.kind !== 'journal') return;
    const { target, date } = write;
    // The sheet's delete button is about the chapter on screen, which for a
    // target opened without an id is the day's first — resolve it the same way
    // the sheet does, or the button silently deletes nothing.
    const entryId = activeJournalChapterId(current.chapters, target.entryId);
    if (!entryId) return;
    const doomed = { ...target, entryId };
    try {
      await deleteJournalChapter(doomed, date);
    } catch (error) {
      Alert.alert(
        t('note.couldNotSaveTitle', { noun: t('note.journalNoun') }),
        error instanceof Error ? error.message : t('errors.somethingWentWrongRetry'),
      );
      return;
    }
    const removedAt = journalChapterIndex(current.chapters, entryId);
    const remaining = current.chapters.filter((chapter) => chapter.id !== entryId);
    const neighbour = remaining[Math.max(0, Math.min(removedAt - 1, remaining.length - 1))];
    onSavedRef.current?.(date, null, doomed);
    await load({ ...target, entryId: neighbour?.id }, date);
  }, [load, t]);

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

  /**
   * Gather the chapters that are about to leave the journal.
   *
   * The draft on screen is written **first**, then every chapter is read back:
   * the file and the fingerprints then come from the same rows in the same
   * pass, which is the whole reason they cannot disagree. `chapterIds` null
   * means the whole day — a day with nothing to choose, or a reader who
   * changed nothing in the picker.
   */
  const gatherJournalShare = useCallback(
    async (
      target: NoteEditorTarget & { kind: 'journal' },
      date: string,
      body: string,
      chapterIds: readonly string[] | null,
    ) => {
      await persist(body);
      const written = persistTargetRef.current?.target;
      const reread = written?.kind === 'journal' ? written : target;
      const chapters = await loadJournalChapters(reread, date);
      return { chapters, ...planJournalShare(chapters, chapterIds) };
    },
    [persist],
  );

  const share = useCallback(
    async (body: string, chapterIds: readonly string[] | null) => {
      const current = sessionRef.current;
      const write = persistTargetRef.current;
      if (!current || !write || savingRef.current) return;
      const generation = openGenerationRef.current;
      const journal =
        write.target.kind === 'journal'
          ? await gatherJournalShare(write.target, write.date, body, chapterIds)
          : null;
      if (generation !== openGenerationRef.current) return;
      const message = journal ? journal.message : body.trim();
      if (!message) return;
      const label = noteEditorLabel(write.target);
      const title = [noteEditorTitle(write.target), write.date]
        .filter(Boolean)
        .join(' · ');
      const part: NoteSharePart | undefined = journal?.part;
      const fileName = noteShareFileName({
        kind: noteEditorKind(write.target),
        label: label || undefined,
        date: write.date,
        part,
        sharedAt: new Date(),
      });
      try {
        await presentNoteShare({ title, body: message, fileName });
        if (journal && write.target.kind === 'journal') {
          const marked = await markJournalChaptersShared(
            write.target.notebookId,
            write.date,
            journal.picked,
          );
          if (generation !== openGenerationRef.current) return;
          setSession((s) =>
            s
              ? {
                  ...s,
                  chapters: journal.chapters,
                  chapterShareFingerprints: { ...s.chapterShareFingerprints, ...marked },
                }
              : s,
          );
          return;
        }
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
    [gatherJournalShare, t],
  );

  return {
    session,
    saving,
    open,
    dismiss,
    persist,
    save,
    share,
    selectChapter,
    addChapter,
    removeChapter,
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
          chapterShareFingerprints: session.chapterShareFingerprints,
          autoStartDictation: session.autoStartDictation === true,
          chapters: session.chapters,
          activeChapterId:
            session.target.kind === 'journal' ? (session.target.entryId ?? null) : null,
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
          chapterShareFingerprints: {} as Record<string, string>,
          autoStartDictation: false,
          chapters: [] as JournalChapter[],
          activeChapterId: null,
          saving: false,
        },
  };
}

export type NoteEditorSession = ReturnType<typeof useNoteEditorSession>;
