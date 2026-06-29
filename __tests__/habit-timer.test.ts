import {
  buildTimerSessionPayload,
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
      { startedAt: '2025-01-01T10:00:00.000Z' },
      new Date('2025-01-01T10:01:30.000Z').getTime(),
    );
    expect(total).toBe(150);
  });
});
