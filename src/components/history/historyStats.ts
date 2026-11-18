/**
 * The figures across the top of a tracker's history tile: at most three big
 * numbers, each with a caption key. A figure that is zero and means "nothing
 * yet" is left out instead of printed, so the row never reads as a reproach;
 * the count of days always stays, so the row keeps its place.
 */
export interface HistoryStat {
  id: 'done' | 'streak' | 'average' | 'best' | 'days';
  value: string;
  captionKey: string;
  /** Drives the caption's plural. */
  count?: number;
  /** Interpolated into captions that name what a counter counts. */
  unit?: string;
}

export type HistoryStatsInput =
  | {
      kind: 'habit';
      daysDone: number;
      streak: number;
      bestRun: number;
      /** `weeks` for a times-a-week habit: its run is counted in weeks. */
      streakUnit?: 'days' | 'weeks';
      /** A timer habit's average session, already formatted. */
      averageLabel?: string;
    }
  | {
      kind: 'counter';
      bestValue: number;
      average: number;
      daysLogged: number;
      unit: string;
    };

export function historyStats(input: HistoryStatsInput): HistoryStat[] {
  if (input.kind === 'habit') {
    const stats: HistoryStat[] = [
      {
        id: 'done',
        value: String(input.daysDone),
        captionKey: 'history.statDaysDone',
        count: input.daysDone,
      },
    ];
    if (input.averageLabel != null) {
      stats.push({ id: 'average', value: input.averageLabel, captionKey: 'history.statAverage' });
    } else if (input.streak > 0) {
      stats.push({
        id: 'streak',
        value: String(input.streak),
        captionKey:
          input.streakUnit === 'weeks' ? 'history.statInARowWeeks' : 'history.statInARow',
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

  const stats: HistoryStat[] = [];
  if (input.daysLogged > 0) {
    stats.push(
      {
        id: 'best',
        value: formatQuantity(input.bestValue),
        captionKey: 'history.statBestDay',
        unit: input.unit,
      },
      {
        id: 'average',
        value: formatQuantity(input.average),
        captionKey: 'history.statAverageUnit',
        unit: input.unit,
      },
    );
  }
  stats.push({
    id: 'days',
    value: String(input.daysLogged),
    captionKey: 'history.statDaysLogged',
    count: input.daysLogged,
  });
  return stats;
}

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
