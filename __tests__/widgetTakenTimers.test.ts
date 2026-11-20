import {
  parseWidgetTakenTimers,
  withoutTimersTakenByWidget,
} from '../src/db/repositories/activeTimerRepository';
import type { ActiveTimerSession } from '../src/protocol';

const session = (startedAt: string, pausedAt: string | null = null): ActiveTimerSession => ({
  startedAt,
  pausedAt,
  pauseOffsetMs: 0,
  calendarDate: startedAt.slice(0, 10),
});

describe('timers the widget took over from the app', () => {
  // The exact text the widget writes: TodayRulesTest.takingATimerOverKeepsItsTimeAndWritesWhichOneWasTaken
  // asserts the Kotlin side produces this string. Change both together.
  const WRITTEN_BY_WIDGET = '{"s":"2026-11-20T08:00:00.000Z"}';

  it('reads what the widget writes', () => {
    expect(parseWidgetTakenTimers(WRITTEN_BY_WIDGET)).toEqual({ s: '2026-11-20T08:00:00.000Z' });
  });

  it('treats a missing, empty or broken value as nothing taken', () => {
    expect(parseWidgetTakenTimers(null)).toEqual({});
    expect(parseWidgetTakenTimers('')).toEqual({});
    expect(parseWidgetTakenTimers('{not json')).toEqual({});
    expect(parseWidgetTakenTimers('{"s":7}')).toEqual({});
  });

  it('lets go of the session the widget took, so its time is not counted twice', () => {
    const sessions = {
      s: session('2026-11-20T08:00:00.000Z', '2026-11-20T08:10:00.000Z'),
      r: session('2026-11-20T09:00:00.000Z'),
    };
    const { kept, released } = withoutTimersTakenByWidget(sessions, parseWidgetTakenTimers(WRITTEN_BY_WIDGET));
    expect(Object.keys(kept)).toEqual(['r']);
    expect(released).toEqual(['s']);
  });

  it('keeps a newer session on the same habit: only the one that was taken goes', () => {
    const sessions = { s: session('2026-11-20T11:00:00.000Z') };
    const { kept, released } = withoutTimersTakenByWidget(sessions, parseWidgetTakenTimers(WRITTEN_BY_WIDGET));
    expect(kept).toBe(sessions);
    expect(released).toEqual([]);
  });
});
