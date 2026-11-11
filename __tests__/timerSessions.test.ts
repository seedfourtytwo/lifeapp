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
    expect(nextTimerSessions(started, { type: 'clearHeartbeats' })).toBe(started);
    expect(nextTimerSessions(started, { type: 'remove', elementId: 'other' })).toBe(started);
  });

  it('stamps a heartbeat at most every thirty seconds, and never while paused', () => {
    const started = nextTimerSessions({}, { type: 'start', elementId: ID, nowMs: T0 });
    const beat = nextTimerSessions(started, { type: 'heartbeat', elementId: ID, nowMs: T0 + 1_000 });

    expect(nextTimerSessions(beat, { type: 'heartbeat', elementId: ID, nowMs: T0 + 20_000 })).toBe(beat);
    const paused = nextTimerSessions(beat, { type: 'pause', elementId: ID, nowMs: T0 + 40_000 });
    expect(nextTimerSessions(paused, { type: 'heartbeat', elementId: ID, nowMs: T0 + 80_000 })).toBe(paused);
  });

  it('drops the heartbeat on resume so a pause is not taken for a death', () => {
    const started = nextTimerSessions({}, { type: 'start', elementId: ID, nowMs: T0 });
    const beat = nextTimerSessions(started, { type: 'heartbeat', elementId: ID, nowMs: T0 + 1_000 });
    const paused = nextTimerSessions(beat, { type: 'pause', elementId: ID, nowMs: T0 + 2_000 });

    const resumed = nextTimerSessions(paused, { type: 'resume', elementId: ID, nowMs: T0 + 3_000 });

    expect(resumed[ID]).not.toHaveProperty('heartbeatAt');
  });

  it('never makes the pause offset negative when the clock went back', () => {
    const started = nextTimerSessions({}, { type: 'start', elementId: ID, nowMs: T0 });
    const paused = nextTimerSessions(started, { type: 'pause', elementId: ID, nowMs: T0 + 60_000 });

    const resumed = nextTimerSessions(paused, { type: 'resume', elementId: ID, nowMs: T0 - 3_600_000 });

    expect(resumed[ID].pauseOffsetMs).toBe(0);
  });
});
