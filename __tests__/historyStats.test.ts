import { historyStats } from '../src/components/history/historyStats';

describe('historyStats', () => {
  it('shows days done, the current run and the best run for a yes/no habit', () => {
    expect(
      historyStats({ kind: 'habit', daysDone: 24, streak: 4, bestRun: 9 }),
    ).toEqual([
      { id: 'done', value: '24', captionKey: 'history.statDaysDone', count: 24 },
      { id: 'streak', value: '4', captionKey: 'history.statInARow', count: 4 },
      { id: 'best', value: '9', captionKey: 'history.statBestRun', count: 9 },
    ]);
  });

  it('leaves out a run of zero rather than printing it', () => {
    const stats = historyStats({ kind: 'habit', daysDone: 3, streak: 0, bestRun: 0 });
    expect(stats.map((s) => s.id)).toEqual(['done']);
  });

  it('keeps days done even at zero, so the row never disappears', () => {
    const stats = historyStats({ kind: 'habit', daysDone: 0, streak: 0, bestRun: 0 });
    expect(stats).toEqual([
      { id: 'done', value: '0', captionKey: 'history.statDaysDone', count: 0 },
    ]);
  });

  it('puts the average time in the middle for a timer habit', () => {
    const stats = historyStats({
      kind: 'habit',
      daysDone: 24,
      streak: 4,
      bestRun: 9,
      averageLabel: '11:40',
    });
    expect(stats.map((s) => [s.id, s.value])).toEqual([
      ['done', '24'],
      ['average', '11:40'],
      ['best', '9'],
    ]);
  });

  it('shows best day, average and days logged for a counter', () => {
    expect(
      historyStats({ kind: 'counter', bestValue: 3, average: 1.84, daysLogged: 21, unit: 'cups' }),
    ).toEqual([
      { id: 'best', value: '3', captionKey: 'history.statBestDay', unit: 'cups' },
      { id: 'average', value: '1.8', captionKey: 'history.statAverageUnit', unit: 'cups' },
      { id: 'days', value: '21', captionKey: 'history.statDaysLogged', count: 21 },
    ]);
  });

  it('shows only days logged for a counter with nothing logged', () => {
    expect(
      historyStats({ kind: 'counter', bestValue: 0, average: 0, daysLogged: 0, unit: 'cups' }),
    ).toEqual([{ id: 'days', value: '0', captionKey: 'history.statDaysLogged', count: 0 }]);
  });
});
