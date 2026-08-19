import { expandOccurrences } from '../src/calendar/occurrences';
import { CalendarEventSchema, type Calendar, type CalendarEvent, type CalendarReminder } from '../src/calendar/types';

type ScheduleArgs = {
  identifier: string;
  content: { title: string; body: string };
  trigger: { type: string; date?: Date; hour?: number; minute?: number };
};

const mockScheduleNotificationAsync = jest.fn(async (_args: ScheduleArgs) => 'notif-id');
const mockCancelScheduledNotificationAsync = jest.fn(async (_identifier: string) => undefined);
const mockGetAllScheduledNotificationsAsync = jest.fn(
  async () => [] as { identifier: string }[],
);
const mockGetPermissionsAsync = jest.fn(
  async () => ({ granted: true, ios: undefined as { status: string } | undefined }),
);
const mockRequestPermissionsAsync = jest.fn(
  async () => ({ granted: true, ios: undefined as { status: string } | undefined }),
);
const mockSetNotificationHandler = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: mockSetNotificationHandler,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  IosAuthorizationStatus: { PROVISIONAL: 'provisional' },
}));

const calendar: Calendar = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Personal',
  color: '#3D7EA6',
  source: 'local',
};

/** Deterministic valid-UUID stand-in so tests can use short readable labels. */
function uuidFor(label: string): string {
  const hex = Buffer.from(label).toString('hex').padEnd(12, '0').slice(0, 12);
  return `550e8400-e29b-41d4-a716-${hex}`;
}

function timedEvent(label: string, startAt: Date, durationMinutes = 60): CalendarEvent {
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  return CalendarEventSchema.parse({
    id: uuidFor(label),
    calendarId: calendar.id,
    uid: `uid-${label}`,
    title: `Event ${label}`,
    notes: null,
    eventType: 'general',
    allDay: false,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    timezone: 'Europe/Berlin',
    rrule: null,
  });
}

function reminder(
  label: string,
  eventLabel: string,
  offsetMinutes: number,
  enabled = true,
): CalendarReminder {
  return { id: uuidFor(label), eventId: uuidFor(eventLabel), offsetMinutes, enabled };
}

/** calendarReminders.native.ts has closure-scoped singleton state — reset per test for isolation. */
function freshModule(available: boolean): typeof import('../src/notifications/calendarReminders.native') {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
  const { NativeModules } = require('react-native');
  if (available) {
    NativeModules.ExpoPushTokenManager = {};
  } else {
    delete NativeModules.ExpoPushTokenManager;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
  return require('../src/notifications/calendarReminders.native');
}

describe('calendarReminders.native', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, ios: undefined });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, ios: undefined });
  });

  it('no-ops entirely when the native notifications module is unavailable', async () => {
    const mod = freshModule(false);

    await mod.syncCalendarReminders({
      events: [timedEvent('e1', inOneHour)],
      calendars: [calendar],
      reminders: [reminder('r1', 'e1', 10)],
    });

    expect(mockGetAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('always cancels existing cal-reminder- notifications first, even with nothing to schedule', async () => {
    const mod = freshModule(true);
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'cal-reminder-stale' },
      { identifier: 'habit-reminder-untouched' },
    ]);

    await mod.syncCalendarReminders({ events: [], calendars: [calendar], reminders: [] });

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('cal-reminder-stale');
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'habit-reminder-untouched',
    );
  });

  it('schedules nothing when there are no enabled reminders or no events', async () => {
    const mod = freshModule(true);

    await mod.syncCalendarReminders({
      events: [timedEvent('e1', inOneHour)],
      calendars: [calendar],
      reminders: [reminder('r1', 'e1', 10, false)],
    });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();

    await mod.syncCalendarReminders({
      events: [],
      calendars: [calendar],
      reminders: [reminder('r1', 'e1', 10, true)],
    });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a DATE reminder at event start minus the offset', async () => {
    const mod = freshModule(true);
    const start = new Date('2026-06-02T09:00:00.000Z');

    jest.useFakeTimers().setSystemTime(now);
    await mod.syncCalendarReminders({
      events: [timedEvent('e1', start)],
      calendars: [calendar],
      reminders: [reminder('r1', 'e1', 30)],
    });
    jest.useRealTimers();

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [call] = mockScheduleNotificationAsync.mock.calls;
    expect(call![0].trigger.date!.toISOString()).toBe('2026-06-02T08:30:00.000Z');
  });

  it('skips a reminder whose fire time has already passed', async () => {
    const mod = freshModule(true);
    const start = new Date(now.getTime() + 5 * 60 * 1000); // 5 min from now

    jest.useFakeTimers().setSystemTime(now);
    await mod.syncCalendarReminders({
      events: [timedEvent('e1', start)],
      calendars: [calendar],
      // Offset of 30 min means the fire time is 25 min in the past.
      reminders: [reminder('r1', 'e1', 30)],
    });
    jest.useRealTimers();

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('excludes occurrences whose cleared key is passed in', async () => {
    const mod = freshModule(true);
    const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const event = timedEvent('e1', start);
    // Derive the real occurrenceKey the same way the sync code does.
    const [occurrence] = expandOccurrences(
      [event],
      new Map([[calendar.id, calendar]]),
      new Date(now.getTime() - 60_000),
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
    );

    jest.useFakeTimers().setSystemTime(now);
    await mod.syncCalendarReminders({
      events: [event],
      calendars: [calendar],
      reminders: [reminder('r1', 'e1', 10)],
      clearedOccurrenceKeys: new Set([occurrence!.occurrenceKey]),
    });
    jest.useRealTimers();

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('caps scheduled reminders and keeps the earliest ones', async () => {
    const mod = freshModule(true);
    const events: CalendarEvent[] = [];
    const reminders: CalendarReminder[] = [];
    // 70 distinct events, each 1 hour apart, one reminder each — over the cap of 64.
    for (let i = 0; i < 70; i++) {
      const id = `e${i}`;
      const start = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000);
      events.push(timedEvent(id, start));
      reminders.push(reminder(`r${i}`, id, 10));
    }

    jest.useFakeTimers().setSystemTime(now);
    await mod.syncCalendarReminders({ events, calendars: [calendar], reminders });
    jest.useRealTimers();

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(64);
    const scheduledTitles = mockScheduleNotificationAsync.mock.calls.map(
      (c) => c[0].content.body,
    );
    // The 65th-earliest event onward must not appear.
    expect(scheduledTitles.some((body: string) => body.includes('Event e69'))).toBe(false);
  });
});
