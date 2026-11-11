import { activeTimerElapsedMs, type ActiveTimerSession } from '../src/protocol';
import { timerSessionFromMidnight, timerSessionParts } from '../src/protocol/timerSessionDays';

/**
 * Where a timer session's seconds go. Run in Chris's zone, where the clocks
 * went forward on 29 March 2026, so the clock-change night is a real one.
 */

const previousTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});
afterAll(() => {
  process.env.TZ = previousTz;
});

const MIN = 60_000;
const HOUR = 60 * MIN;

function at(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

function running(startedAt: Date, extra: Partial<ActiveTimerSession> = {}): ActiveTimerSession {
  return {
    startedAt: startedAt.toISOString(),
    pausedAt: null,
    pauseOffsetMs: 0,
    calendarDate: `${startedAt.getFullYear()}-${String(startedAt.getMonth() + 1).padStart(2, '0')}-${String(startedAt.getDate()).padStart(2, '0')}`,
    ...extra,
  };
}

function seconds(session: ActiveTimerSession, now: Date): [string, number][] {
  return timerSessionParts(session, now.getTime()).map((part) => [part.date, part.seconds]);
}

describe('a session across midnight', () => {
  it('gives each day the seconds that happened on it', () => {
    expect(seconds(running(at(2026, 11, 10, 23, 50)), at(2026, 11, 11, 0, 20))).toEqual([
      ['2026-11-10', 10 * 60],
      ['2026-11-11', 20 * 60],
    ]);
  });

  it('and killed after midnight, counts only up to where the core paused it, its last heartbeat', () => {
    const session = running(at(2026, 11, 10, 23, 50), { pausedAt: at(2026, 11, 11, 0, 5).toISOString() });
    const now = at(2026, 11, 11, 7);
    expect(seconds(session, now)).toEqual([
      ['2026-11-10', 10 * 60],
      ['2026-11-11', 5 * 60],
    ]);
  });

  it('counts the real hours of the spring-forward night', () => {
    // 23:30 to 03:30 on the wall is three real hours: 02:00 never happened.
    expect(seconds(running(at(2026, 3, 28, 23, 30)), at(2026, 3, 29, 3, 30))).toEqual([
      ['2026-03-28', 30 * 60],
      ['2026-03-29', 2.5 * 60 * 60],
    ]);
  });

  it('spans a whole day in between when it ran that long', () => {
    const session = running(at(2026, 11, 9, 23), { pausedAt: at(2026, 11, 11, 1).toISOString() });
    const now = at(2026, 11, 11, 9);
    expect(seconds(session, now)).toEqual([
      ['2026-11-09', 60 * 60],
      ['2026-11-10', 24 * 60 * 60],
      ['2026-11-11', 60 * 60],
    ]);
  });

  it('puts paused time first, so a session paused before midnight stays on that day', () => {
    const paused = running(at(2026, 11, 10, 23), { pausedAt: at(2026, 11, 10, 23, 30).toISOString() });
    expect(seconds(paused, at(2026, 11, 11, 0, 30))).toEqual([['2026-11-10', 30 * 60]]);

    const resumed = running(at(2026, 11, 10, 23), { pauseOffsetMs: 20 * MIN });
    expect(seconds(resumed, at(2026, 11, 11, 0, 30))).toEqual([
      ['2026-11-10', 40 * 60],
      ['2026-11-11', 30 * 60],
    ]);
  });

  it('never loses a second to rounding at the boundary', () => {
    const started = new Date(at(2026, 11, 11, 0).getTime() - 500);
    expect(seconds(running(started), new Date(started.getTime() + 1_700))).toEqual([['2026-11-11', 1]]);
    const long = running(at(2026, 11, 10, 22, 0));
    const total = timerSessionParts(long, at(2026, 11, 11, 3).getTime() + 999).reduce(
      (sum, part) => sum + part.seconds,
      0,
    );
    expect(total).toBe(5 * 60 * 60);
  });

  it('logs at least one second on the day it started, as a stop always has', () => {
    const started = at(2026, 11, 11, 8);
    expect(seconds(running(started), started)).toEqual([['2026-11-11', 1]]);
  });
});

describe('the part of a session that belongs to today', () => {
  it('starts at midnight and keeps running', () => {
    const now = at(2026, 11, 11, 0, 20);
    const today = timerSessionFromMidnight(running(at(2026, 11, 10, 23, 50)), now.getTime());
    expect(today).toEqual({
      startedAt: at(2026, 11, 11, 0).toISOString(),
      pausedAt: null,
      pauseOffsetMs: 0,
      calendarDate: '2026-11-11',
    });
    expect(seconds(today, now)).toEqual([['2026-11-11', 20 * 60]]);
  });

  it('holds nothing when the session was paused before midnight', () => {
    const now = at(2026, 11, 11, 0, 30);
    const today = timerSessionFromMidnight(
      running(at(2026, 11, 10, 23), { pausedAt: at(2026, 11, 10, 23, 30).toISOString() }),
      now.getTime(),
    );
    expect(today.pausedAt).toBe(at(2026, 11, 11, 0).toISOString());
    expect(activeTimerElapsedMs(today, now.getTime() + HOUR)).toBe(0);
  });

  it('carries the pause that fell after midnight', () => {
    const now = at(2026, 11, 11, 0, 40);
    // Ten minutes active, all of it after midnight once ninety paused minutes go first.
    const session = running(at(2026, 11, 10, 23), { pauseOffsetMs: 90 * MIN });
    const today = timerSessionFromMidnight(session, now.getTime());
    expect(today.pauseOffsetMs).toBe(30 * MIN);
    expect(seconds(today, now)).toEqual([['2026-11-11', 10 * 60]]);
  });
});
