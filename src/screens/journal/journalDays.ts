import type { DailyJournal, JournalNotebook } from '../../protocol';

/** What the days are narrowed to: every notebook, or one by id. */
export type JournalFilter = 'all' | string;

/** One day in one notebook, as it is written on the Journal page. */
export type JournalDayEntry = {
  key: string;
  date: string;
  notebookId: string;
  /** The day's chapters in order, a line apart. */
  text: string;
};

/**
 * The days that have something written, newest first, for the Journal page.
 *
 * A day written in two notebooks is two entries, in the notebooks' own order.
 * Chapters of one notebook on one day read as one entry. Days with nothing
 * written are not here, and neither are chapters saved blank.
 */
export function journalDayEntries(
  journals: readonly DailyJournal[],
  notebooks: readonly Pick<JournalNotebook, 'id'>[],
  filter: JournalFilter,
): JournalDayEntry[] {
  const order = new Map(notebooks.map((notebook, index) => [notebook.id, index]));
  const byKey = new Map<string, JournalDayEntry>();

  for (const journal of journals) {
    if (filter !== 'all' && journal.notebookId !== filter) continue;
    const body = journal.body.trim();
    if (!body) continue;
    const key = `${journal.date}|${journal.notebookId}`;
    const existing = byKey.get(key);
    if (existing) existing.text = `${existing.text}\n${body}`;
    else byKey.set(key, { key, date: journal.date, notebookId: journal.notebookId, text: body });
  }

  const rank = (entry: JournalDayEntry) => order.get(entry.notebookId) ?? order.size;
  return [...byKey.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || rank(a) - rank(b),
  );
}
