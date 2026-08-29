import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';
import type { ActivityDay } from '../screens/shared/ActivityStrip';
import { lastNDates } from '../utils/dates';

/** Days shown in the Home strip — two weeks reads as a shape, a month as noise. */
export const ACTIVITY_DAYS = 14;

/**
 * The last fortnight for a set of trackers: one entry per day, marked where
 * anything at all was logged.
 *
 * Deliberately not part of the event store. This is a read-only glance at
 * history, it is wanted by two tabs with different tracker sets, and it must
 * never delay first paint — all four Home tabs mount at startup, so the query
 * runs after the screen is already on screen and the strip appears when it
 * lands. A stale strip for one frame is fine; a slower Home is not.
 */
export function useRecentActivity(elementIds: string[]): ActivityDay[] {
  const [days, setDays] = useState<ActivityDay[]>([]);
  /** Rising counter so a slow query cannot overwrite a newer one. */
  const loadRef = useRef(0);

  // A stable key: the hook re-runs when the *set* changes, not on every render
  // that happens to rebuild the array.
  const key = elementIds.join(',');

  const load = useCallback(async () => {
    const generation = ++loadRef.current;
    if (elementIds.length === 0) {
      setDays([]);
      return;
    }

    const dates = lastNDates(ACTIVITY_DAYS);
    try {
      const db = await getDatabase();
      const totals = await eventRepo.getDailyTotalsForElementsSince(
        db,
        elementIds,
        dates[0]!,
      );
      if (generation !== loadRef.current) return;

      const active = new Set<string>();
      for (const rows of totals.values()) {
        for (const row of rows) {
          if (row.total > 0) active.add(row.date);
        }
      }
      setDays(dates.map((date) => ({ date, active: active.has(date) })));
    } catch {
      // Non-fatal: the strip is a glance, not a record. It stays hidden.
      if (generation === loadRef.current) setDays([]);
    }
    // `key` stands in for the id set; `elementIds` itself is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return days;
}
