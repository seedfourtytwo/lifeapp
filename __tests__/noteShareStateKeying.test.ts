import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../src/db/migrations';
import * as shareRepo from '../src/db/repositories/noteShareStateRepository';

/**
 * What a journal share fingerprint is now keyed by.
 *
 * Up to v22 a journal's row was `(journal, '', notebookId, date)` — one
 * fingerprint for the whole day, with the notebook id squatting in the column
 * meant for an entry. Sharing a subset of chapters makes that key a lie, so it
 * moved: the notebook is the element, the chapter row is the entry.
 *
 * `note_share_state` is `bundleKey: null` — a disposable local cache, never
 * backed up — so rows written under the old key are simply not found and the
 * icon reads "never shared" again. No migration; these cases pin down that the
 * old rows are inert and that a fresh share sweeps them away.
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
const NOTEBOOK = '550e8400-e29b-41d4-a716-446655440300';
const OTHER_NOTEBOOK = '550e8400-e29b-41d4-a716-446655440301';
const CHAPTER_A = '550e8400-e29b-41d4-a716-446655440401';
const CHAPTER_B = '550e8400-e29b-41d4-a716-446655440402';

describe('journal share state keying', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;

  beforeEach(async () => {
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
    await runMigrations(db);
  });

  afterEach(() => {
    raw.close();
  });

  function legacyRow(notebookId: string, date: string) {
    raw
      .prepare(
        `INSERT INTO note_share_state (kind, element_id, entry_id, date, body_fp, shared_at)
         VALUES ('journal', '', ?, ?, 'old', '2025-01-01T00:00:00.000Z')`,
      )
      .run(notebookId, date);
  }

  function rowCount(): number {
    return (raw.prepare('SELECT COUNT(*) AS n FROM note_share_state').get() as { n: number })
      .n;
  }

  it('records one fingerprint per chapter of a notebook day', async () => {
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
      { chapterId: CHAPTER_B, bodyFp: 'fp-b' },
    ]);

    const found = await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, DATE);
    expect(found).toEqual({ [CHAPTER_A]: 'fp-a', [CHAPTER_B]: 'fp-b' });
  });

  it('leaves the chapters that were not shared without a fingerprint', async () => {
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
    ]);

    const found = await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, DATE);
    expect(found[CHAPTER_B]).toBeUndefined();
  });

  it('overwrites a chapter fingerprint when it is shared again', async () => {
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
    ]);
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a2' },
    ]);

    expect(await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, DATE)).toEqual({
      [CHAPTER_A]: 'fp-a2',
    });
  });

  it('keeps two notebooks and two days apart', async () => {
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
    ]);
    await shareRepo.upsertJournalChapterShareState(db, OTHER_NOTEBOOK, DATE, [
      { chapterId: CHAPTER_B, bodyFp: 'fp-b' },
    ]);

    expect(await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, DATE)).toEqual({
      [CHAPTER_A]: 'fp-a',
    });
    expect(await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, '2025-04-02')).toEqual(
      {},
    );
  });

  it('does not read a pre-v22 whole-day row as a chapter', async () => {
    legacyRow(NOTEBOOK, DATE);
    expect(await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, DATE)).toEqual({});
  });

  it('sweeps the pre-v22 row away the next time that day is shared', async () => {
    legacyRow(NOTEBOOK, DATE);
    legacyRow(NOTEBOOK, '2025-04-02');

    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
    ]);

    // The other day's stale row is untouched: it is cache, not corruption.
    expect(rowCount()).toBe(2);
    expect(
      raw
        .prepare(
          `SELECT COUNT(*) AS n FROM note_share_state WHERE element_id = '' AND date = ?`,
        )
        .get(DATE),
    ).toEqual({ n: 0 });
  });

  it('forgets a chapter on its own when that chapter goes', async () => {
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
      { chapterId: CHAPTER_B, bodyFp: 'fp-b' },
    ]);

    await shareRepo.deleteShareState(
      db,
      { kind: 'journal', elementId: NOTEBOOK, entryId: CHAPTER_A },
      DATE,
    );

    expect(await shareRepo.getJournalDayShareFingerprints(db, NOTEBOOK, DATE)).toEqual({
      [CHAPTER_B]: 'fp-b',
    });
  });

  it('drops both key shapes when a notebook is deleted', async () => {
    legacyRow(NOTEBOOK, DATE);
    await shareRepo.upsertJournalChapterShareState(db, NOTEBOOK, '2025-04-05', [
      { chapterId: CHAPTER_B, bodyFp: 'fp-b' },
    ]);
    await shareRepo.upsertJournalChapterShareState(db, OTHER_NOTEBOOK, DATE, [
      { chapterId: CHAPTER_A, bodyFp: 'fp-a' },
    ]);

    await shareRepo.deleteShareStateForJournalNotebook(db, NOTEBOOK);

    expect(rowCount()).toBe(1);
    expect(await shareRepo.getJournalDayShareFingerprints(db, OTHER_NOTEBOOK, DATE)).toEqual({
      [CHAPTER_A]: 'fp-a',
    });
  });

  it('leaves tracker day notes on the key they always had', async () => {
    const element = '550e8400-e29b-41d4-a716-446655440500';
    await shareRepo.upsertShareState(
      db,
      { kind: 'tracker', elementId: element, entryId: '' },
      DATE,
      'fp-note',
    );

    expect(
      await shareRepo.getShareFingerprint(
        db,
        { kind: 'tracker', elementId: element, entryId: '' },
        DATE,
      ),
    ).toBe('fp-note');
  });
});
