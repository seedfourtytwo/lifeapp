import { nextTimerSessions } from '../src/store/events/timerSessions';

const ID = 'habit';
const T0 = new Date(2026, 2, 10, 8, 0).getTime();

describe('the timer session reducer', () => {
  it('starts, pauses and resumes, counting the pause', () => {
    const started = nextTimerSessions({}, { type: 'start', elementId: ID, nowMs: T0 });
    const paused = nextTimerSessions(started, { type: 'pause', elementId: ID, nowMs: T0 + 60_000 });
    const resumed = nextTimerSessions(paused, { type: 'resume', elementId: ID, nowMs: T0 + 90_000 });

    expect(paused[ID].pausedAt).toBe(new Date(T0 + 60_000).toISOString());
    expect(resumed[ID]).toMatchObject({ pausedAt: null, pauseOffsetMs: 30_000 });
  });

  it('hands back the same sessions when a step changes nothing', () => {
    const started = nextTimerSessions({}, { type: 'start', elementId: ID, nowMs: T0 });

    expect(nextTimerSessions(started, { type: 'start', elementId: ID, nowMs: T0 + 1 })).toBe(started);
    expect(nextTimerSessions(started, { type: 'resume', elementId: ID, nowMs: T0 + 1 })).toBe(started);
    expect(nextTimerSessions(started, { type: 'pause', elementId: 'other', nowMs: T0 + 1 })).toBe(started);
  });

  it('never makes the pause offset negative when the clock went back', () => {
    const started = nextTimerSessions({}, { type: 'start', elementId: ID, nowMs: T0 });
    const paused = nextTimerSessions(started, { type: 'pause', elementId: ID, nowMs: T0 + 60_000 });

    const resumed = nextTimerSessions(paused, { type: 'resume', elementId: ID, nowMs: T0 - 3_600_000 });

    expect(resumed[ID].pauseOffsetMs).toBe(0);
  });
});
