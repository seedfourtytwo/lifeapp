import { CommitmentConfigSchema, CounterConfigSchema, HabitConfigSchema, type DayFacts } from '../src/protocol';
import { completedDates, computeTrackerStreaks } from '../src/utils/trackerStreaks';

const facts = (total: number, extra: Partial<DayFacts> = {}): DayFacts => ({
  total,
  trackCompleted: false,
  markedComplete: false,
  ...extra,
});

const checkOff = { kind: 'habit' as const, config: HabitConfigSchema.parse({ timeSlot: 'anytime' }) };
const playOnce = {
  kind: 'habit' as const,
  config: HabitConfigSchema.parse({
    trackingMode: 'timer',
    timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
  }),
};
const counter = (dailyTarget?: number) => ({
  kind: 'counter' as const,
  config: CounterConfigSchema.parse({ unit: 'reps', quickIncrements: [1], dailyTarget }),
});

describe('completedDates', () => {
  it('lists only the days the rule calls done', () => {
    expect(
      completedDates(playOnce, [
        { date: '2026-07-20', facts: facts(1340) },
        { date: '2026-07-21', facts: facts(40, { trackCompleted: true }) },
        { date: '2026-07-22', facts: facts(100, { markedComplete: true }) },
      ]),
    ).toEqual(['2026-07-21', '2026-07-22']);
  });

  it('lists nothing for a counter without a target', () => {
    expect(completedDates(counter(), [{ date: '2026-07-21', facts: facts(99) }])).toEqual([]);
  });
});

describe('computeTrackerStreaks', () => {
  it('counts a habit success streak and its failure streak', () => {
    expect(
      computeTrackerStreaks(
        checkOff,
        [
          { date: '2025-01-01', facts: facts(1) },
          { date: '2025-01-02', facts: facts(1) },
        ],
        '2025-01-02',
      ),
    ).toEqual({ streak: 2, failureStreak: 0 });
  });

  it('counts counter target-hit days ending today or yesterday', () => {
    const days = [
      { date: '2026-07-20', facts: facts(50) },
      { date: '2026-07-21', facts: facts(50) },
      { date: '2026-07-22', facts: facts(40) },
      { date: '2026-07-23', facts: facts(50) },
    ];
    expect(computeTrackerStreaks(counter(50), days, '2026-07-23').streak).toBe(1);
    expect(computeTrackerStreaks(counter(50), days.slice(0, 2), '2026-07-22').streak).toBe(2);
  });

  it('gives a counter without a target no streak', () => {
    expect(
      computeTrackerStreaks(counter(), [{ date: '2026-07-23', facts: facts(10) }], '2026-07-23').streak,
    ).toBe(0);
  });

  it('ignores days before the tracker was created', () => {
    expect(
      computeTrackerStreaks(
        checkOff,
        [
          { date: '2025-01-01', facts: facts(1) },
          { date: '2025-01-02', facts: facts(1) },
        ],
        '2025-01-02',
        '2025-01-02',
      ),
    ).toEqual({ streak: 1, failureStreak: 0 });
  });
});

describe('a commitment', () => {
  const commitment = {
    kind: 'commitment' as const,
    config: CommitmentConfigSchema.parse({ clearSince: '2026-03-01T08:00:00.000Z' }),
  };

  it('keeps every day without a slip, logged or not, back to the day it was made', () => {
    expect(
      computeTrackerStreaks(commitment, [], '2026-03-10', '2026-03-01'),
    ).toEqual({ streak: 10, failureStreak: 0 });
  });

  it('counts the run from the day after the last slip', () => {
    expect(
      computeTrackerStreaks(commitment, [{ date: '2026-03-05', facts: facts(1) }], '2026-03-10', '2026-03-01')
        .streak,
    ).toBe(5);
  });

  it('counts a day with a slip today as not kept, the run before it standing', () => {
    expect(
      computeTrackerStreaks(commitment, [{ date: '2026-03-10', facts: facts(1) }], '2026-03-10', '2026-03-01'),
    ).toEqual({ streak: 9, failureStreak: 0 });
  });
});
