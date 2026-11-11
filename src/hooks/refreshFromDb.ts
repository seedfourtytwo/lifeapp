import { useEventStore } from '../store/eventStore';
import { ensureCurrentDay } from './ensureCurrentDay';
import { refreshAllDailyData } from './refreshAllDailyData';

let running: Promise<void> | null = null;
let queued: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  await useEventStore.getState().reloadActiveTimerSessions();
  await ensureCurrentDay();
  await refreshAllDailyData();
}

/**
 * Bring every store that mirrors today's SQLite rows back in line with them:
 * trackers, today's totals and done state, streaks and timer sessions. Rows
 * written by anyone — this app, an import, the widget's queue — show after
 * one call.
 *
 * Safe at any time: it only reads, apart from the day rollover, and the
 * element load waits its turn for the write lock like any write. Calls made
 * while one runs share a single follow-up pass, which starts after the
 * running one so it sees everything written before the call.
 */
export function refreshFromDb(): Promise<void> {
  if (!running) {
    running = refreshOnce().finally(() => {
      running = null;
    });
    return running;
  }
  if (!queued) {
    queued = running
      .catch(() => undefined)
      .then(() => {
        queued = null;
        return refreshFromDb();
      });
  }
  return queued;
}
