import {
  buildHabitReadyLockScreenMeta,
  buildHabitTimerLockScreenMeta,
} from '../src/kinds/habit/habitTimerLockScreenMeta';
import type { ActiveTimerSession, HabitConfig } from '../src/protocol';

describe('buildHabitTimerLockScreenMeta', () => {
  const session: ActiveTimerSession = {
    startedAt: '2025-01-01T10:00:00.000Z',
    pausedAt: null,
    pauseOffsetMs: 0,
    calendarDate: '2025-01-01',
  };

  const config: HabitConfig = {
    trackingMode: 'timer',
    timeSlot: 'anytime',
    schedule: { type: 'daily' },
    dailyTargetSeconds: 900,
  };

  it('includes habit name and running elapsed vs target', () => {
    const meta = buildHabitTimerLockScreenMeta(
      'Mobility',
      session,
      config,
      new Date('2025-01-01T10:01:30.000Z').getTime(),
    );
    expect(meta.title).toBe('Mobility');
    expect(meta.artist).toBe('Life Dashboard');
    expect(meta.albumTitle).toBe('Running · 1:30 / 15:00');
  });

  it('labels paused sessions', () => {
    const paused: ActiveTimerSession = {
      ...session,
      pausedAt: '2025-01-01T10:01:00.000Z',
    };
    const meta = buildHabitTimerLockScreenMeta(
      'Mobility',
      paused,
      { trackingMode: 'timer', timeSlot: 'anytime', schedule: { type: 'daily' } },
      new Date('2025-01-01T10:05:00.000Z').getTime(),
    );
    expect(meta.albumTitle).toBe('Paused · 1:00');
  });

  it('describes ready-to-start habits', () => {
    const meta = buildHabitReadyLockScreenMeta(
      'Breathwork',
      { trackingMode: 'timer', timeSlot: 'anytime', schedule: { type: 'daily' } },
      '2/3',
    );
    expect(meta.title).toBe('Breathwork');
    expect(meta.albumTitle).toBe('Ready · Play to start · 2/3');
  });
});
