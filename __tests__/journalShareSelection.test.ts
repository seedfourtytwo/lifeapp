import { joinJournalDayBodies } from '../src/protocol';
import type { JournalChapter } from '../src/notes/journalChapters';
import {
  DRAFT_CHAPTER_ID,
  defaultShareSelection,
  journalShareChapters,
  journalShareSelectionText,
  planJournalShare,
  toggleShareSelection,
} from '../src/notes/journalShareSelection';
import { noteBodyFingerprint } from '../src/notes/noteShareStatus';
import { noteShareFileName } from '../src/notes/noteShareFileName';

/**
 * Choosing which chapters leave the journal.
 *
 * The one thing that must never drift: the text handed to the share sheet is
 * `joinJournalDayBodies` of exactly the chapters that were picked — the same
 * bodies whose fingerprints get recorded. These cases pin that down, plus the
 * "whole day" test the filename uses to decide whether a file is a subset.
 */

const chapters: JournalChapter[] = [
  { id: 'a', body: 'Morning walk', draft: false },
  { id: 'b', body: 'Long meeting', draft: false },
  { id: 'c', body: 'Evening read', draft: false },
];

describe('journalShareChapters', () => {
  it('numbers the day and shows the chapter on screen as it stands', () => {
    const views = journalShareChapters(chapters, 'b', 'Long meeting, revised');
    expect(views.map((v) => [v.number, v.id, v.body])).toEqual([
      [1, 'a', 'Morning walk'],
      [2, 'b', 'Long meeting, revised'],
      [3, 'c', 'Evening read'],
    ]);
    expect(views.every((v) => v.draft === false)).toBe(true);
  });

  it('appends a chapter that has no row yet', () => {
    const views = journalShareChapters(chapters, 'fresh', 'Just started');
    expect(views).toHaveLength(4);
    expect(views[3]).toEqual({ id: 'fresh', number: 4, body: 'Just started', draft: true });
  });

  it('gives an empty day a single draft view with a stand-in id', () => {
    const views = journalShareChapters([], null, 'First words');
    expect(views).toEqual([
      { id: DRAFT_CHAPTER_ID, number: 1, body: 'First words', draft: true },
    ]);
  });
});

describe('share selection', () => {
  const views = journalShareChapters(chapters, 'a', 'Morning walk');

  it('defaults to the whole day, which is what sharing did before', () => {
    expect(defaultShareSelection(views)).toEqual(['a', 'b', 'c']);
  });

  it('toggles one chapter without disturbing the others', () => {
    const after = toggleShareSelection(views, ['a', 'b', 'c'], 'b');
    expect(after).toEqual(['a', 'c']);
    expect(toggleShareSelection(views, after, 'b')).toEqual(['a', 'b', 'c']);
  });

  it('keeps the day order however the chapters were picked', () => {
    expect(toggleShareSelection(views, ['c'], 'a')).toEqual(['a', 'c']);
  });

  it('forgets an id whose chapter is no longer in the day', () => {
    expect(toggleShareSelection(views, ['a', 'gone'], 'c')).toEqual(['a', 'c']);
  });
});

describe('journalShareSelectionText', () => {
  const views = journalShareChapters(chapters, 'b', 'Long meeting, revised');

  it('joins the picked chapters with the one day separator there is', () => {
    expect(journalShareSelectionText(views, ['a', 'c'])).toBe(
      joinJournalDayBodies(['Morning walk', 'Evening read']),
    );
    expect(journalShareSelectionText(views, ['a', 'c'])).toBe('Morning walk\n\nEvening read');
  });

  it('emits one chapter alone with no separator at all', () => {
    expect(journalShareSelectionText(views, ['b'])).toBe('Long meeting, revised');
  });

  it('emits the whole day when everything is picked', () => {
    expect(journalShareSelectionText(views, ['a', 'b', 'c'])).toBe(
      'Morning walk\n\nLong meeting, revised\n\nEvening read',
    );
  });

  it('is empty when nothing is picked', () => {
    expect(journalShareSelectionText(views, [])).toBe('');
  });

  it('ignores ids that name no chapter of this day', () => {
    expect(journalShareSelectionText(views, ['a', 'gone'])).toBe('Morning walk');
  });
});

/**
 * The one thing a partial share can get wrong.
 *
 * A fingerprint that covers more text than the file does leaves the share icon
 * amber forever: the reader sends chapter two, the record describes the whole
 * day, and nothing they do will ever make the two match. The plan is what
 * makes that impossible — the bodies joined into the file are the same objects
 * whose fingerprints get written, so there is no second reading to drift.
 */
describe('planJournalShare', () => {
  const day: JournalChapter[] = [
    { id: 'a', body: 'Morning walk', draft: false },
    // A body with its own blank line: the join is not a format anyone can
    // parse back out, which is exactly why the record is per chapter.
    { id: 'b', body: 'Long meeting\n\nran over', draft: false },
    { id: 'c', body: 'Evening read', draft: false },
  ];

  it('fingerprints exactly the chapters that are in the file', () => {
    const plan = planJournalShare(day, ['a', 'c']);

    expect(plan.picked.map((chapter) => chapter.id)).toEqual(['a', 'c']);
    expect(plan.message).toBe(
      joinJournalDayBodies(plan.picked.map((chapter) => chapter.body)),
    );
    expect(plan.picked.map((chapter) => noteBodyFingerprint(chapter.body))).toEqual([
      noteBodyFingerprint('Morning walk'),
      noteBodyFingerprint('Evening read'),
    ]);
  });

  it('takes the whole day when nothing was chosen', () => {
    const plan = planJournalShare(day, null);
    expect(plan.picked).toHaveLength(3);
    expect(plan.part).toEqual({ chapters: [1, 2, 3], total: 3 });
  });

  it('numbers the picked chapters by their place in the day', () => {
    expect(planJournalShare(day, ['b']).part).toEqual({ chapters: [2], total: 3 });
  });

  it('ignores an id belonging to a chapter that is no longer there', () => {
    const plan = planJournalShare(day, ['a', 'gone']);
    expect(plan.message).toBe('Morning walk');
    expect(plan.part).toEqual({ chapters: [1], total: 3 });
  });

  it('names a whole-day file exactly as it was named before chapters could be picked', () => {
    const plan = planJournalShare(day, null);
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Ideas',
        date: '2026-08-14',
        part: plan.part,
      }),
    ).toBe('ideas-2026-08-14.txt');
  });

  it('marks a subset in the file name so it is not mistaken for the day', () => {
    const plan = planJournalShare(day, ['b']);
    expect(
      noteShareFileName({
        kind: 'journal',
        label: 'Ideas',
        date: '2026-08-14',
        part: plan.part,
      }),
    ).toBe('ideas-2026-08-14-ch2.txt');
  });
});
