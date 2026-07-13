import { computeHabitStreaksFromEvents } from '../src/utils/habitStreakCompute';
import { HabitConfigSchema } from '../src/protocol';

describe('computeHabitStreaksFromEvents', () => {
  const config = HabitConfigSchema.parse({ timeSlot: 'anytime' });

  it('computes success and failure streaks from events', () => {
    const result = computeHabitStreaksFromEvents(
      [
        {
          id: '1',
          elementId: 'habit-1',
          timestamp: '2025-01-01T10:00:00.000Z',
          date: '2025-01-01',
          value: 1,
          meta: { source: 'habit_tick' },
          protocolVersion: 1,
        },
        {
          id: '2',
          elementId: 'habit-1',
          timestamp: '2025-01-02T10:00:00.000Z',
          date: '2025-01-02',
          value: 1,
          meta: { source: 'habit_tick' },
          protocolVersion: 1,
        },
      ],
      config,
      '2025-01-02',
    );

    expect(result.streak).toBe(2);
    expect(result.failureStreak).toBe(0);
  });
});
