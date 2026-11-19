import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatabase } from '../../db/client';
import * as eventRepo from '../../db/repositories/eventRepository';
import type { ElementDefinition } from '../../protocol';
import {
  isMissable,
  loadReviewData,
  REVIEW_RANGE_DAYS,
  reviewWindowDates,
  type ReviewTrackerData,
} from '../../review';

/** One load of everything Review draws, for the day it was read on. */
export interface ReviewData {
  today: string;
  trackers: ReviewTrackerData[];
  /** Daily totals by tracker then date — only counters without a target have any. */
  totals: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

/**
 * Twice the longest range: the Year headline compares with the year before.
 * Week and Month are cut from the same load, so switching range reads nothing.
 */
const LOAD_DAYS = 2 * REVIEW_RANGE_DAYS.year;

async function readReviewData(
  elements: readonly ElementDefinition[],
  today: string,
): Promise<ReviewData> {
  const db = await getDatabase();
  const trackers = await loadReviewData(db, { elements, days: LOAD_DAYS, today });

  // The day history says whether a day was logged, not how much. Only a
  // counter without a target shows an amount, so only those are read.
  const untargeted = trackers
    .filter(({ tracker }) => !isMissable(tracker.rules))
    .map(({ tracker }) => tracker.id);
  const totals = new Map<string, Map<string, number>>();
  if (untargeted.length > 0) {
    const since = reviewWindowDates(today, REVIEW_RANGE_DAYS.year)[0];
    const rows = await eventRepo.getDailyTotalsForElementsSince(db, untargeted, since);
    for (const [id, days] of rows) {
      totals.set(id, new Map(days.map((day) => [day.date, day.total])));
    }
  }
  return { today, trackers, totals };
}

/**
 * Review's data for `elements` as of `today`. Reads when the page becomes
 * active, when the day rolls over and when the trackers change — and never
 * while the page is off screen. What was loaded stays up while a newer read
 * is under way, so the page does not blank between visits.
 */
export function useReviewData(
  active: boolean,
  elements: readonly ElementDefinition[],
  today: string,
): { data: ReviewData | null; failed: boolean; retry: () => void } {
  const [data, setData] = useState<ReviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    if (!active) return;
    const mine = ++generation.current;
    readReviewData(elements, today).then(
      (next) => {
        if (mine !== generation.current) return;
        setData(next);
        setFailed(false);
      },
      () => {
        if (mine === generation.current) setFailed(true);
      },
    );
  }, [active, elements, today, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, failed, retry };
}
