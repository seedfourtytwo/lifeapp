import { HabitConfigSchema } from '../src/protocol';
import { shouldPlayHabitCompletionChime } from '../src/utils/habitCompletionChime';

describe('shouldPlayHabitCompletionChime', () => {
  const timerWithTarget = HabitConfigSchema.parse({
    timeSlot: 'anytime',
    trackingMode: 'timer',
    dailyTargetSeconds: 900,
  });

  it('plays when a timer target is newly reached', () => {
    expect(
      shouldPlayHabitCompletionChime(timerWithTarget, 800, 900, [], []),
    ).toBe(true);
  });

  it('does not replay when the target was already met', () => {
    expect(
      shouldPlayHabitCompletionChime(timerWithTarget, 900, 950, [], []),
    ).toBe(false);
  });

  it('plays when a play_once track finishes', () => {
    const config = HabitConfigSchema.parse({
      timeSlot: 'anytime',
      trackingMode: 'timer',
      timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
    });
    expect(
      shouldPlayHabitCompletionChime(config, 0, 120, [], [], { trackCompleted: true }),
    ).toBe(true);
  });
});
