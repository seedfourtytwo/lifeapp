import { CommitmentConfigSchema, HabitConfigSchema, factsFromTotal, type DayFacts } from '../src/protocol';
import { dayStrip } from '../src/utils/dayStrip';

const TODAY = '2026-03-10';

function factsOn(entries: [string, number][]): Map<string, DayFacts> {
  return new Map(entries.map(([date, total]) => [date, factsFromTotal(total)]));
}

describe('a day strip', () => {
  const commitment = {
    kind: 'commitment' as const,
    config: CommitmentConfigSchema.parse({ clearSince: '2026-03-08T08:00:00.000Z' }),
  };

  it('runs oldest first and ends today', () => {
    expect(dayStrip(commitment, new Map(), TODAY, null, 3).map(({ date }) => date)).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
  });

  it('marks a commitment day kept, slipped, or not counted before it existed', () => {
    expect(
      dayStrip(commitment, factsOn([['2026-03-09', 1]]), TODAY, '2026-03-08', 4).map(({ state }) => state),
    ).toEqual(['not_counted', 'done', 'not_done', 'done']);
  });

  it('marks a habit day not due when its schedule skips it', () => {
    // 6 March 2026 is a Friday; 7 and 8 are the weekend.
    const weekdays = {
      kind: 'habit' as const,
      config: HabitConfigSchema.parse({ schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } }),
    };
    expect(
      dayStrip(weekdays, factsOn([['2026-03-09', 1]]), TODAY, null, 5).map(({ state }) => state),
    ).toEqual(['not_done', 'not_due', 'not_due', 'done', 'not_done']);
  });
});
