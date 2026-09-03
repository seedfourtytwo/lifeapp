/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../src/db/client';
import { exportProtocolBundle, importProtocolBundle } from '../src/db/export';
import { runMigrations } from '../src/db/migrations';
import * as journalRepo from '../src/db/repositories/dailyJournalRepository';
import * as noteShareRepo from '../src/db/repositories/noteShareStateRepository';
import {
  deleteJournalChapter,
  loadJournalChapters,
  loadNoteBody,
  saveNoteBody,
} from '../src/notes/noteSave';
import {
  activeJournalChapterId,
  journalChapterIndex,
} from '../src/notes/journalChapters';
import { journalShareChapters, journalShareSelectionText } from '../src/notes/journalShareSelection';
import { noteEditorSessionKey } from '../src/notes/sessionKey';

/**
 * What the editor does to SQLite, at the seam the sheet actually calls.
 *
 * The dangerous half of chapters is here: an editor that still addresses "the
 * day" deletes a chapter the reader never touched. Every case below is one
 * that used to be impossible to get wrong because there was only ever one row.
 */

type Bind = null | number | string;

function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  } as unknown as SQLiteDatabase;
}

const DATE = '2025-05-06';
const CHAPTER_TWO = '550e8400-e29b-41d4-a716-446655440301';

describe('editing one chapter of a notebook day', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;
  let notebookId: string;

  beforeEach(async () => {
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
    await runMigrations(db);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    notebookId = (raw.prepare('SELECT id FROM journal_notebooks LIMIT 1').get() as {
      id: string;
    }).id;
  });

  afterEach(() => {
    raw.close();
  });

  function journalTarget(entryId?: string) {
    return { kind: 'journal' as const, notebookId, entryId, label: 'Journal' };
  }

  async function seedTwoChapters() {
    await journalRepo.upsertJournal(db, { notebookId, date: DATE, body: 'Morning' });
    await journalRepo.upsertJournal(db, {
      id: CHAPTER_TWO,
      notebookId,
      date: DATE,
      body: 'Evening',
    });
  }

  it('loads the chapter the target names', async () => {
    await seedTwoChapters();

    expect(await loadNoteBody(journalTarget(CHAPTER_TWO), DATE)).toBe('Evening');
    expect(await loadNoteBody(journalTarget(), DATE)).toBe('Morning');
  });

  it('loads a blank body for a chapter that has not been written yet', async () => {
    await seedTwoChapters();

    expect(
      await loadNoteBody(journalTarget('550e8400-e29b-41d4-a716-446655440399'), DATE),
    ).toBe('');
  });

  it('saves a never-seen id as a new chapter at the end of the day', async () => {
    await seedTwoChapters();

    const saved = await saveNoteBody(
      journalTarget('550e8400-e29b-41d4-a716-446655440302'),
      DATE,
      'Night',
    );

    expect(saved?.id).toBe('550e8400-e29b-41d4-a716-446655440302');
    const chapters = await loadJournalChapters(journalTarget(), DATE);
    expect(chapters.map((c) => c.body)).toEqual(['Morning', 'Evening', 'Night']);
  });

  it('clearing a chapter deletes only that chapter', async () => {
    await seedTwoChapters();

    await saveNoteBody(journalTarget(CHAPTER_TWO), DATE, '  ');

    const chapters = await loadJournalChapters(journalTarget(), DATE);
    expect(chapters.map((c) => c.body)).toEqual(['Morning']);
  });

  /**
   * A share fingerprint belongs to the chapter that was shared.
   *
   * It used to belong to the day, which meant deleting one chapter could not
   * be allowed to drop it. Now the record is per chapter — that is what lets
   * the reader send two chapters out of four — so the doomed chapter takes its
   * own fingerprint with it and the others keep reading "shared".
   */
  it('deleting a chapter forgets that chapter’s share state and no other', async () => {
    await seedTwoChapters();
    const first = (await loadJournalChapters(journalTarget(), DATE))[0]!;
    await noteShareRepo.upsertJournalChapterShareState(db, notebookId, DATE, [
      { chapterId: first.id, bodyFp: 'fp-morning' },
      { chapterId: CHAPTER_TWO, bodyFp: 'fp-evening' },
    ]);

    await deleteJournalChapter(journalTarget(CHAPTER_TWO), DATE);

    expect((await loadJournalChapters(journalTarget(), DATE)).map((c) => c.body)).toEqual([
      'Morning',
    ]);
    expect(await noteShareRepo.getJournalDayShareFingerprints(db, notebookId, DATE)).toEqual({
      [first.id]: 'fp-morning',
    });
  });

  it('clearing a chapter to whitespace forgets its share state too', async () => {
    await seedTwoChapters();
    const first = (await loadJournalChapters(journalTarget(), DATE))[0]!;
    await noteShareRepo.upsertJournalChapterShareState(db, notebookId, DATE, [
      { chapterId: first.id, bodyFp: 'fp-morning' },
      { chapterId: CHAPTER_TWO, bodyFp: 'fp-evening' },
    ]);

    await saveNoteBody(journalTarget(CHAPTER_TWO), DATE, '   ');

    expect(await noteShareRepo.getJournalDayShareFingerprints(db, notebookId, DATE)).toEqual({
      [first.id]: 'fp-morning',
    });
  });

  it('forgets the first chapter’s share state when it is cleared without an id', async () => {
    await journalRepo.upsertJournal(db, { notebookId, date: DATE, body: 'Only one' });
    const only = (await loadJournalChapters(journalTarget(), DATE))[0]!;
    await noteShareRepo.upsertJournalChapterShareState(db, notebookId, DATE, [
      { chapterId: only.id, bodyFp: 'fp' },
    ]);

    // Opening a notebook from Home names no chapter — clearing then has to
    // resolve which row it just deleted, or the fingerprint outlives the text.
    await saveNoteBody(journalTarget(), DATE, ' ');

    expect(await noteShareRepo.getJournalDayShareFingerprints(db, notebookId, DATE)).toEqual(
      {},
    );
  });

  /**
   * The backup is the only copy of a journal that leaves the phone. A restore
   * that folded a day's chapters back into one body would lose the shape of
   * the day permanently — there is no second copy to compare against.
   */
  it('carries every chapter of a day through a backup round-trip', async () => {
    await seedTwoChapters();

    const bundle = await exportProtocolBundle();
    await importProtocolBundle(bundle);

    const chapters = await loadJournalChapters(journalTarget(), DATE);
    expect(chapters.map((c) => c.body)).toEqual(['Morning', 'Evening']);
  });
});

describe('chapter helpers', () => {
  const chapters = [
    { id: 'a', body: 'One', draft: false },
    { id: 'b', body: 'Two', draft: false },
  ];

  it('reads an unset id as the day’s first chapter, not a new one', () => {
    expect(activeJournalChapterId(chapters, undefined)).toBe('a');
    expect(activeJournalChapterId(chapters, 'b')).toBe('b');
    expect(activeJournalChapterId([], undefined)).toBeNull();
  });

  it('keeps the draft in the day when no chapter is named yet', () => {
    // Opening a notebook from Home names no chapter; the day must still carry
    // the live draft rather than the last-written text of chapter one.
    const wholeDay = (rows: typeof chapters, entryId: string | undefined, draft: string) => {
      const views = journalShareChapters(rows, activeJournalChapterId(rows, entryId), draft);
      return journalShareSelectionText(views, views.map((view) => view.id));
    };
    expect(wholeDay(chapters, undefined, 'Redone')).toBe('Redone\n\nTwo');
    expect(wholeDay([], undefined, 'First words')).toBe('First words');
  });

  it('lands on the named chapter, and on the first when the name is stale', () => {
    expect(journalChapterIndex(chapters, 'b')).toBe(1);
    expect(journalChapterIndex(chapters, 'gone')).toBe(0);
    expect(journalChapterIndex(chapters, undefined)).toBe(0);
  });

  it('gives each chapter its own editor session', () => {
    const target = { kind: 'journal' as const, notebookId: 'nb', label: 'Ideas' };
    expect(noteEditorSessionKey({ ...target, entryId: 'a' }, DATE)).not.toBe(
      noteEditorSessionKey({ ...target, entryId: 'b' }, DATE),
    );
  });
});
