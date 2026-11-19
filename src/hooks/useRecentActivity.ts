import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';

const NOTHING_LOGGED: ReadonlyMap<string, number> = new Map();

/**
 * For each date from `since` on: how many of these trackers have anything
 * logged. One aggregate read, for the week strip under Today's date.
 *
 * Deliberately not part of the event store. This is a read-only glance at
 * history and it must never delay first paint — Today mounts at startup, so
 * the query runs after the page is already on screen and the strip fills in
 * when it lands. Today itself is not taken from here: the page reads that live
 * from the day's totals, so only the days behind it can be a query old.
 */
export function useRecentActivity(
  elementIds: string[],
  since: string,
): ReadonlyMap<string, number> {
  const [logged, setLogged] = useState(NOTHING_LOGGED);
  /** Rising counter so a slow query cannot overwrite a newer one. */
  const loadRef = useRef(0);

  // A stable key: the hook re-runs when the *set* changes, not on every render
  // that happens to rebuild the array.
  const key = elementIds.join(',');

  const load = useCallback(async () => {
    const generation = ++loadRef.current;
    if (elementIds.length === 0) {
      setLogged(NOTHING_LOGGED);
      return;
    }

    try {
      const db = await getDatabase();
      const totals = await eventRepo.getDailyTotalsForElementsSince(db, elementIds, since);
      if (generation !== loadRef.current) return;

      const counts = new Map<string, number>();
      for (const rows of totals.values()) {
        for (const row of rows) {
          if (row.total > 0) counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
        }
      }
      setLogged(counts);
    } catch {
      // Non-fatal: the strip is a glance, not a record. Its past days stay empty.
      if (generation === loadRef.current) setLogged(NOTHING_LOGGED);
    }
    // `key` stands in for the id set; `elementIds` itself is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, since]);

  useEffect(() => {
    void load();
  }, [load]);

  return logged;
}
