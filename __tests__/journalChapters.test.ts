import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../src/db/migrations';
import * as journalRepo from '../src/db/repositories/dailyJournalRepository';
import { journalChapterPreview } from '../src/notes/journalChapters';

/**
 * A notebook day holds chapters.
 *
 * The repository is where "one document per day" was really enforced — the
 * upsert reached for the day's only row and the clear deleted every row for
 * the day. Both had to become row-addressed, and these are the cases that
 * would silently eat someone's morning entry if they had not.
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

const DATE = '2025-04-01';

describe('journal chapters in the repository', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;
  let notebookId: string;

  beforeEach(async () => {
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
    await runMigrations(db);
    notebookId = (raw.prepare('SELECT id FROM journal_notebooks LIMIT 1').get() as {
      id: string;
    }).id;
  });

  afterEach(() => {
    raw.close();
  });

  async function addChapter(body: string, id?: string) {
    return journalRepo.upsertJournal(db, { id, notebookId, date: DATE, body });
  }

  it('writes a second chapter instead of overwriting the first', async () => {
    const first = await addChapter('Morning pages');
    const second = await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440201',
      notebookId,
      date: DATE,
      body: 'Evening pages',
    });

    const chapters = await journalRepo.getJournalChapters(db, notebookId, DATE);
    expect(chapters.map((c) => [c.sortOrder, c.body])).toEqual([
      [0, 'Morning pages'],
      [1, 'Evening pages'],
    ]);
    expect(first?.id).not.toBe(second?.id);
  });

  it('edits the chapter it is handed, not the day', async () => {
    await addChapter('Morning pages');
    const second = await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440202',
      notebookId,
      date: DATE,
      body: 'Evening pages',
    });

    await journalRepo.upsertJournal(db, {
      id: second!.id,
      notebookId,
      date: DATE,
      body: 'Evening pages, revised',
    });

    const chapters = await journalRepo.getJournalChapters(db, notebookId, DATE);
    expect(chapters.map((c) => c.body)).toEqual(['Morning pages', 'Evening pages, revised']);
  });

  it('clearing one chapter leaves the day’s other chapters alone', async () => {
    const first = await addChapter('Morning pages');
    await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440203',
      notebookId,
      date: DATE,
      body: 'Evening pages',
    });

    await journalRepo.upsertJournal(db, {
      id: first!.id,
      notebookId,
      date: DATE,
      body: '   ',
    });

    const chapters = await journalRepo.getJournalChapters(db, notebookId, DATE);
    expect(chapters.map((c) => [c.sortOrder, c.body])).toEqual([[0, 'Evening pages']]);
  });

  it('closes the gap after a chapter is deleted', async () => {
    const first = await addChapter('One');
    const second = await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440204',
      notebookId,
      date: DATE,
      body: 'Two',
    });
    await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440205',
      notebookId,
      date: DATE,
      body: 'Three',
    });

    await journalRepo.deleteJournal(db, second!.id);

    const chapters = await journalRepo.getJournalChapters(db, notebookId, DATE);
    expect(chapters.map((c) => [c.sortOrder, c.body])).toEqual([
      [0, 'One'],
      [1, 'Three'],
    ]);
    expect(first!.sortOrder).toBe(0);
  });

  it('counts chapters per notebook for a day', async () => {
    await addChapter('One');
    await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440206',
      notebookId,
      date: DATE,
      body: 'Two',
    });

    const counts = await journalRepo.getJournalChapterCountsOnDate(db, DATE);
    expect(counts.get(notebookId)).toBe(2);
    expect((await journalRepo.getJournalChapterCountsOnDate(db, '2025-04-02')).size).toBe(0);
  });

  it('appends a moved notebook’s chapters rather than merging their text', async () => {
    const otherId = '550e8400-e29b-41d4-a716-446655440210';
    raw
      .prepare(
        'INSERT INTO journal_notebooks (id, name, color, icon, sort_order, created_at, protocol_version) VALUES (?,?,?,NULL,?,?,1)',
      )
      .run(otherId, 'Ideas', '#64748B', 1, '2025-01-01T00:00:00.000Z');
    await addChapter('Kept here');
    await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440211',
      notebookId: otherId,
      date: DATE,
      body: 'Moved across',
    });

    await journalRepo.reassignJournalsToNotebook(db, otherId, notebookId);

    const chapters = await journalRepo.getJournalChapters(db, notebookId, DATE);
    expect(chapters.map((c) => [c.sortOrder, c.body])).toEqual([
      [0, 'Kept here'],
      [1, 'Moved across'],
    ]);
  });

  it('reads the whole day as one text for sharing', async () => {
    await addChapter('Morning');
    await journalRepo.upsertJournal(db, {
      id: '550e8400-e29b-41d4-a716-446655440207',
      notebookId,
      date: DATE,
      body: 'Evening',
    });

    expect(await journalRepo.getJournalDayBody(db, notebookId, DATE)).toBe(
      'Morning\n\nEvening',
    );
  });
});

describe('journalChapterPreview', () => {
  it('takes the first few words of the body', () => {
    expect(journalChapterPreview('Quiet morning, kept the phone downstairs and read.')).toBe(
      'Quiet morning, kept the phone…',
    );
  });

  it('leaves a short body whole', () => {
    expect(journalChapterPreview('Two words')).toBe('Two words');
  });

  it('collapses newlines so the label stays one line', () => {
    expect(journalChapterPreview('First line\n\nSecond line')).toBe('First line Second line');
  });

  it('returns an empty string for a blank chapter', () => {
    expect(journalChapterPreview('   \n ')).toBe('');
  });
});
