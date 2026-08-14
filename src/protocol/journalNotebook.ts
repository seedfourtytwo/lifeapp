import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { OptionalTrackerIconSchema } from './trackerIcons';

/** Phone Home meta row stays usable; extra icons only appear after the user adds notebooks. */
export const JOURNAL_NOTEBOOK_MAX = 5;
export const JOURNAL_NOTEBOOK_NAME_MAX = 40;

/** Fixed identity palette — not a free color picker. */
export const JOURNAL_NOTEBOOK_COLORS = [
  '#64748B',
  '#2563EB',
  '#0D9488',
  '#16A34A',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#9333EA',
] as const;

export type JournalNotebookColor = (typeof JOURNAL_NOTEBOOK_COLORS)[number];

export const DEFAULT_JOURNAL_NOTEBOOK_COLOR: JournalNotebookColor =
  JOURNAL_NOTEBOOK_COLORS[0];
export const DEFAULT_JOURNAL_NOTEBOOK_NAME = 'Journal';

const JOURNAL_NOTEBOOK_COLOR_SET = new Set<string>(JOURNAL_NOTEBOOK_COLORS);

export function isJournalNotebookColor(value: string): value is JournalNotebookColor {
  return JOURNAL_NOTEBOOK_COLOR_SET.has(value);
}

export const JournalNotebookColorSchema = z.enum(JOURNAL_NOTEBOOK_COLORS);

/**
 * User-defined journal notebook (personal text catalog — not an element kind).
 * Home shows one icon per notebook; entries live on DailyJournal.notebookId.
 */
export const JournalNotebookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(JOURNAL_NOTEBOOK_NAME_MAX),
  color: JournalNotebookColorSchema,
  icon: OptionalTrackerIconSchema,
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type JournalNotebook = z.infer<typeof JournalNotebookSchema>;

export function validateBundleJournalNotebooks(notebooks: JournalNotebook[]): void {
  if (notebooks.length > JOURNAL_NOTEBOOK_MAX) {
    throw new Error(`At most ${JOURNAL_NOTEBOOK_MAX} journal notebooks`);
  }
  const seen = new Set<string>();
  for (const notebook of notebooks) {
    if (seen.has(notebook.id)) {
      throw new Error(`Duplicate journal notebook ${notebook.id}`);
    }
    seen.add(notebook.id);
  }
}

export function nextJournalNotebookColor(
  used: readonly string[],
): JournalNotebookColor {
  const usedSet = new Set(used);
  return (
    JOURNAL_NOTEBOOK_COLORS.find((color) => !usedSet.has(color)) ??
    DEFAULT_JOURNAL_NOTEBOOK_COLOR
  );
}