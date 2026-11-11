/**
 * Open once the app has finished starting: settings and trackers loaded,
 * the timer mirrored, today's state read and the widget queue drained.
 * Work that should not compete with start-up (the daily backup) waits here.
 */
let done = false;
let waiters: (() => void)[] = [];

export function whenStartupDone(): Promise<void> {
  if (done) return Promise.resolve();
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

export function markStartupDone(): void {
  done = true;
  const waiting = waiters;
  waiters = [];
  for (const wake of waiting) wake();
}
