import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatabase } from '../../db/client';
import type { ElementDefinition } from '../../protocol';
import { loadReviewData, type ReviewTrackerData } from '../../review';

/** One load of everything Review draws, for the day it was read on. */
export interface ReviewData {
  today: string;
  trackers: ReviewTrackerData[];
}

/**
 * Two years: the Year headline compares 52 weeks with the 52 before them, and
 * the run of full days is counted back through the same load. Week and Month
 * are cut from it too, so switching range reads nothing.
 */
export const REVIEW_LOAD_DAYS = 730;

async function readReviewData(
  elements: readonly ElementDefinition[],
  today: string,
): Promise<ReviewData> {
  const db = await getDatabase();
  return { today, trackers: await loadReviewData(db, { elements, days: REVIEW_LOAD_DAYS, today }) };
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
