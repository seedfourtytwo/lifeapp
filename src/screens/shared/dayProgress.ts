/** Past this many items a segment is too thin to count by eye. */
export const MAX_PROGRESS_SEGMENTS = 24;

export type DayProgress = {
  /** One piece per item due, or a single bar filled by share. */
  shape: 'segments' | 'bar';
  done: number;
  due: number;
};

/**
 * How the day's progress line is drawn from the figures `buildTodayModel`
 * counts: `null` when nothing is due, otherwise `done` held between 0 and
 * `due` so the bar and the tally can never read "7 / 5".
 */
export function dayProgress(done: number, due: number): DayProgress | null {
  if (!Number.isFinite(due) || due <= 0) return null;
  return {
    shape: due > MAX_PROGRESS_SEGMENTS ? 'bar' : 'segments',
    done: Math.min(Math.max(Number.isFinite(done) ? done : 0, 0), due),
    due,
  };
}
