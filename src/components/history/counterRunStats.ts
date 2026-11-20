import type { HistoryStat } from './historyStats';

/**
 * A targeted counter's run of days that hit the target, and its best run —
 * the two figures a habit shows and a counter used to leave at zero. A zero is
 * left out rather than printed, as in `historyStats`.
 */
export function counterRunStats(input: { streak: number; bestRun: number }): HistoryStat[] {
  const stats: HistoryStat[] = [];
  if (input.streak > 0) {
    stats.push({
      id: 'streak',
      value: String(input.streak),
      captionKey: 'history.statInARow',
      count: input.streak,
    });
  }
  if (input.bestRun > 0) {
    stats.push({
      id: 'best',
      value: String(input.bestRun),
      captionKey: 'history.statBestRun',
      count: input.bestRun,
    });
  }
  return stats;
}
