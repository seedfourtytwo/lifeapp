import { parseWidgetTimerSessions } from '../src/db/repositories/activeTimerRepository';

describe('widget timer sessions', () => {
  // The exact text the widget writes: TodayRulesTest.widgetTimersRoundTrip asserts
  // the Kotlin side produces this string. Change both together.
  const WRITTEN_BY_WIDGET =
    '{"habit-1":{"startedAt":"2026-11-16T08:00:00.000Z","calendarDate":"2026-11-16"}}';

  it('reads what the widget writes', () => {
    expect(parseWidgetTimerSessions(WRITTEN_BY_WIDGET)).toEqual({
      'habit-1': { startedAt: '2026-11-16T08:00:00.000Z', calendarDate: '2026-11-16' },
    });
  });

  it('treats a missing, empty or broken value as no timers', () => {
    expect(parseWidgetTimerSessions(null)).toEqual({});
    expect(parseWidgetTimerSessions('')).toEqual({});
    expect(parseWidgetTimerSessions('{not json')).toEqual({});
    expect(parseWidgetTimerSessions('{"habit-1":{"startedAt":"yesterday"}}')).toEqual({});
  });
});
