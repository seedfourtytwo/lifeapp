/**
 * The days on the Journal page.
 *
 * They are written out — a date, then what was written — so what counts as "a
 * day" has edges: two notebooks on one day, several chapters in one notebook,
 * a chapter saved blank, and the filter.
 */
import type { DailyJournal } from '../src/protocol';
import { journalDayEntries } from '../src/screens/journal/journalDays';

const NOTEBOOKS = [{ id: 'dreams' }, { id: 'work' }];

function chapter(date: string, notebookId: string, body: string, id = `${date}-${notebookId}-${body}`) {
  return { id, date, notebookId, body } as DailyJournal;
}

describe('the days written on the Journal page', () => {
  it('lists the newest day first', () => {
    const days = journalDayEntries(
      [chapter('2026-11-15', 'work', 'a'), chapter('2026-11-17', 'work', 'b')],
      NOTEBOOKS,
      'all',
    );
    expect(days.map((day) => day.date)).toEqual(['2026-11-17', '2026-11-15']);
  });

  it('reads the chapters of one notebook on one day as one entry, in order', () => {
    const days = journalDayEntries(
      [chapter('2026-11-17', 'work', 'Morning.'), chapter('2026-11-17', 'work', 'Evening.')],
      NOTEBOOKS,
      'all',
    );
    expect(days).toHaveLength(1);
    expect(days[0].text).toBe('Morning.\nEvening.');
  });

  it('keeps two notebooks on one day apart, in the notebooks’ order', () => {
    const days = journalDayEntries(
      [chapter('2026-11-17', 'work', 'w'), chapter('2026-11-17', 'dreams', 'd')],
      NOTEBOOKS,
      'all',
    );
    expect(days.map((day) => day.notebookId)).toEqual(['dreams', 'work']);
  });

  it('does not list a day whose only chapter was saved blank', () => {
    expect(journalDayEntries([chapter('2026-11-17', 'work', '  \n ')], NOTEBOOKS, 'all')).toEqual(
      [],
    );
  });

  it('narrows to one notebook', () => {
    const days = journalDayEntries(
      [chapter('2026-11-17', 'work', 'w'), chapter('2026-11-16', 'dreams', 'd')],
      NOTEBOOKS,
      'dreams',
    );
    expect(days.map((day) => day.notebookId)).toEqual(['dreams']);
  });

  it('still lists a notebook it does not know, after the ones it does', () => {
    const days = journalDayEntries(
      [chapter('2026-11-17', 'gone', 'g'), chapter('2026-11-17', 'work', 'w')],
      NOTEBOOKS,
      'all',
    );
    expect(days.map((day) => day.notebookId)).toEqual(['work', 'gone']);
  });
});
