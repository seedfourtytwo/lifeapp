import {
  buildTimerSessionPayload,
  buildTimerSessionPayloadFromDuration,
  formatHabitTimerDuration,
  liveTimerTotalSeconds,
  timerSessionDurationSeconds,
} from '../src/protocol';

describe('formatHabitTimerDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatHabitTimerDuration(90)).toBe('1:30');
    expect(formatHabitTimerDuration(0)).toBe('0:00');
  });

  it('formats hours when needed', () => {
    expect(formatHabitTimerDuration(3661)).toBe('1:01:01');
  });
});

describe('timerSessionDurationSeconds', () => {
  it('returns at least one second', () => {
    const start = new Date('2025-01-01T10:00:00.000Z');
    const end = new Date('2025-01-01T10:00:00.100Z');
    expect(timerSessionDurationSeconds(start, end)).toBe(1);
  });
});

describe('buildTimerSessionPayload', () => {
  it('writes value and typed meta', () => {
    const start = new Date('2025-01-01T10:00:00.000Z');
    const end = new Date('2025-01-01T10:15:00.000Z');
    const payload = buildTimerSessionPayload(start, end);
    expect(payload.value).toBe(900);
    expect(payload.meta.source).toBe('timer_session');
    expect(payload.meta.durationSeconds).toBe(900);
  });
});

describe('liveTimerTotalSeconds', () => {
  it('adds active session elapsed time to logged total', () => {
    const total = liveTimerTotalSeconds(
      60,
      { startedAt: '2025-01-01T10:00:00.000Z', pausedAt: null, pauseOffsetMs: 0 },
      new Date('2025-01-01T10:01:30.000Z').getTime(),
    );
    expect(total).toBe(150);
  });

  it('excludes paused time from the live total', () => {
    const total = liveTimerTotalSeconds(
      0,
      {
        startedAt: '2025-01-01T10:00:00.000Z',
        pausedAt: '2025-01-01T10:01:00.000Z',
        pauseOffsetMs: 0,
      },
      new Date('2025-01-01T10:02:00.000Z').getTime(),
    );
    expect(total).toBe(60);
  });

  it('matches timerSessionDurationSeconds for the same window', () => {
    const startedAt = new Date('2025-01-01T10:00:00.000Z');
    const endedAt = new Date('2025-01-01T10:01:30.500Z');
    const liveTotal = liveTimerTotalSeconds(
      0,
      { startedAt: startedAt.toISOString(), pausedAt: null, pauseOffsetMs: 0 },
      endedAt.getTime(),
    );
    const sessionSeconds = timerSessionDurationSeconds(startedAt, endedAt);
    expect(liveTotal).toBe(sessionSeconds);
  });

  it('buildTimerSessionPayloadFromDuration records track completion', () => {
    const start = new Date('2025-01-01T10:00:00.000Z');
    const end = new Date('2025-01-01T10:15:00.000Z');
    const payload = buildTimerSessionPayloadFromDuration(start, end, 900, {
      trackCompleted: true,
    });
    expect(payload.meta.trackCompleted).toBe(true);
  });
});
