import { useEventStore } from '../store/eventStore';
import { ensureCurrentDay } from './ensureCurrentDay';
import { refreshAllDailyData } from './refreshAllDailyData';
import { drainPendingWidgetActions } from '../widget/pendingWidgetActions';
import { requestWidgetSnapshot } from '../widget/widgetSnapshotWriter';

let running: Promise<void> | null = null;
let queued: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  await useEventStore.getState().reloadActiveTimerSessions();
  await ensureCurrentDay();
  // A queue that cannot be read must not keep the screens from catching up.
  await drainPendingWidgetActions().catch((error: unknown) => {
    console.warn('Widget actions not drained', error);
  });
  await refreshAllDailyData();
  void requestWidgetSnapshot();
}

/**
 * Bring every store that mirrors today's SQLite rows back in line with them:
 * trackers, today's totals and done state, streaks and timer sessions; then
 * the widget's queued taps are applied and its snapshot rewritten. Rows
 * written by anyone — this app, an import, the widget's queue — show after
 * one call.
 *
 * Safe at any time: it only reads, apart from the day rollover and the
 * queued taps, which go through the event commands and their write lock; the
 * element load waits its turn for that lock like any write. Calls made
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
