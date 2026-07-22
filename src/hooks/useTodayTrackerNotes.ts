import { useCallback, useEffect, useState } from 'react';
import { getDatabase } from '../db/client';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import { currentAppCalendarDate } from '../utils/dayRollover';

/** Batch-load per-tracker notes for the current calendar day. */
export function useTodayTrackerNotes(elementIds: string[], now: Date) {
  const [notesToday, setNotesToday] = useState<Map<string, string>>(new Map());
  const idsKey = elementIds.join(',');
  const today = currentAppCalendarDate(now);

  const reload = useCallback(async () => {
    const ids = idsKey.length > 0 ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setNotesToday(new Map());
      return;
    }
    try {
      const db = await getDatabase();
      const notes = await dayNoteRepo.getNotesForElementsOnDate(db, ids, today);
      const map = new Map<string, string>();
      for (const [id, note] of notes) map.set(id, note.body);
      setNotesToday(map);
    } catch {
      // Non-fatal — icons stay empty until next refresh.
    }
  }, [idsKey, today]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applySaved = useCallback(
    (date: string, elementId: string, body: string | null) => {
      if (date !== today) return;
      setNotesToday((prev) => {
        const next = new Map(prev);
        if (body == null || body.length === 0) next.delete(elementId);
        else next.set(elementId, body);
        return next;
      });
    },
    [today],
  );

  return { notesToday, reloadNotesToday: reload, applySaved };
}
