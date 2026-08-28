import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as notebookRepo from '../db/repositories/journalNotebookRepository';
import * as noteShareRepo from '../db/repositories/noteShareStateRepository';
import { withGuardedWrite } from '../db/dataGeneration';
import {
  JOURNAL_NOTEBOOK_MAX,
  JournalNotebookSchema,
  PROTOCOL_VERSION,
  nextJournalNotebookColor,
  type JournalNotebook,
  type JournalNotebookColor,
  type TrackerIconId,
} from '../protocol';
import { newId } from '../utils/id';

export async function createJournalNotebook(input: {
  name: string;
  color: JournalNotebookColor;
  icon?: TrackerIconId;
}): Promise<JournalNotebook | undefined> {
  return withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    const existing = await notebookRepo.getAllNotebooks(db);
    if (existing.length >= JOURNAL_NOTEBOOK_MAX) {
      throw new Error(`At most ${JOURNAL_NOTEBOOK_MAX} notebooks`);
    }
    const notebook = JournalNotebookSchema.parse({
      id: newId(),
      name: input.name,
      color: input.color,
      icon: input.icon,
      sortOrder: await notebookRepo.nextSortOrder(db),
      createdAt: new Date().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
    });
    if (superseded()) return undefined;
    await notebookRepo.insertNotebook(db, notebook);
    return notebook;
  });
}

export async function updateJournalNotebook(
  id: string,
  patch: { name: string; color: JournalNotebookColor; icon?: TrackerIconId },
): Promise<JournalNotebook | null | undefined> {
  return withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return undefined;
    return notebookRepo.updateNotebook(db, id, patch);
  });
}

export async function clearJournalNotebookEntries(id: string): Promise<void> {
  await withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return;
    await dailyJournalRepo.deleteJournalsForNotebook(db, id);
    await noteShareRepo.deleteShareStateForJournalNotebook(db, id);
  });
}

export async function deleteJournalNotebook(id: string): Promise<void> {
  await withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    const notebooks = await notebookRepo.getAllNotebooks(db);
    if (superseded()) return;
    if (notebooks.length <= 1) {
      throw new Error('Cannot delete the last notebook');
    }
    const fallback = notebooks.find((notebook) => notebook.id !== id);
    if (!fallback) {
      throw new Error('Cannot delete the last notebook');
    }
    await dailyJournalRepo.reassignJournalsToNotebook(db, id, fallback.id);
    await noteShareRepo.deleteShareStateForJournalNotebook(db, id);
    await notebookRepo.deleteNotebook(db, id);
  });
}

export async function moveJournalNotebook(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  await withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    const notebooks = await notebookRepo.getAllNotebooks(db);
    if (superseded()) return;
    const index = notebooks.findIndex((notebook) => notebook.id === id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= notebooks.length) return;
    const current = notebooks[index];
    const other = notebooks[swapWith];
    if (!current || !other) return;
    await notebookRepo.setSortOrder(db, current.id, other.sortOrder);
    await notebookRepo.setSortOrder(db, other.id, current.sortOrder);
  });
}

export function suggestedNotebookColor(existing: JournalNotebook[]): JournalNotebookColor {
  return nextJournalNotebookColor(existing.map((notebook) => notebook.color));
}
