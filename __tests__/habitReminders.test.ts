import type { ElementDefinition, HabitConfig } from '../src/protocol';

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

function habitElement(overrides: Partial<HabitConfig> = {}, id = 'h1'): ElementDefinition {
  return {
    id,
    kind: 'habit',
    name: 'Meditate',
    protocolVersion: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    config: {
      timeSlot: 'morning',
      trackingMode: 'boolean',
      schedule: { type: 'daily' },
      timeRange: { start: '07:00', end: '08:00' },
      remindMinutesBefore: 10,
      ...overrides,
    },
  };
}

/** habitReminders.native.ts has closure-scoped singleton state — reset per test for isolation. */
function freshModule(available: boolean): typeof import('../src/notifications/habitReminders.native') {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
  const { NativeModules } = require('react-native');
  if (available) {
    NativeModules.ExpoPushTokenManager = {};
  } else {
    delete NativeModules.ExpoPushTokenManager;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
  return require('../src/notifications/habitReminders.native');
}

describe('habitReminders.native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, ios: undefined });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, ios: undefined });
  });

  describe('isNotificationsNativeAvailable', () => {
    it('reflects whether the push token native module is present', () => {
      expect(freshModule(true).isNotificationsNativeAvailable()).toBe(true);
      expect(freshModule(false).isNotificationsNativeAvailable()).toBe(false);
    });
  });

  describe('syncHabitReminders', () => {
    it('no-ops entirely when the native notifications module is unavailable', async () => {
      const mod = freshModule(false);

      await mod.syncHabitReminders([habitElement()], true);

      expect(mockGetAllScheduledNotificationsAsync).not.toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels existing reminders but schedules nothing when disabled', async () => {
      const mod = freshModule(true);
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'habit-reminder-h1-2025-01-01' },
      ]);

      await mod.syncHabitReminders([habitElement()], false);

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'habit-reminder-h1-2025-01-01',
      );
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules nothing when permission is denied', async () => {
      const mod = freshModule(true);
      mockGetPermissionsAsync.mockResolvedValue({ granted: false, ios: undefined });
      mockRequestPermissionsAsync.mockResolvedValue({ granted: false, ios: undefined });

      await mod.syncHabitReminders([habitElement()], true);

      expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules one DATE start reminder per day in the horizon for a daily habit', async () => {
      const mod = freshModule(true);

      await mod.syncHabitReminders([habitElement()], true);

      // Daily schedule over the 14-day reminder horizon — every fire is
      // a distinct per-day identifier, all DATE-triggered.
      expect(mockScheduleNotificationAsync.mock.calls.length).toBeGreaterThan(1);
      for (const [call] of mockScheduleNotificationAsync.mock.calls) {
        expect(call.identifier).toMatch(/^habit-reminder-h1-/);
        expect(call.trigger.type).toBe('date');
      }
      const identifiers = mockScheduleNotificationAsync.mock.calls.map((c) => c[0].identifier);
      expect(new Set(identifiers).size).toBe(identifiers.length);
    });

    it('skips a habit with no remindMinutesBefore configured', async () => {
      const mod = freshModule(true);
      const element = habitElement({ remindMinutesBefore: undefined });

      await mod.syncHabitReminders([element], true);

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('skips archived habits and non-habit elements', async () => {
      const mod = freshModule(true);
      const archived: ElementDefinition = {
        ...habitElement({}, 'h2'),
        archivedAt: '2025-06-01T00:00:00.000Z',
      };
      const counter: ElementDefinition = {
        id: 'c1',
        kind: 'counter',
        name: 'Pushups',
        protocolVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        config: { unit: 'reps', quickIncrements: [5] },
      };

      await mod.syncHabitReminders([archived, counter], true);

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('scheduleEndOfDayReminder', () => {
    it('cancels the previous evening reminder before scheduling a new DAILY one', async () => {
      const mod = freshModule(true);

      await mod.scheduleEndOfDayReminder(true, '20:30');

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-reminder-eod');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const [call] = mockScheduleNotificationAsync.mock.calls;
      expect(call[0].identifier).toBe('habit-reminder-eod');
      expect(call[0].trigger).toEqual({ type: 'daily', hour: 20, minute: 30 });
    });

    it('only cancels and does not reschedule when disabled', async () => {
      const mod = freshModule(true);

      await mod.scheduleEndOfDayReminder(false);

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-reminder-eod');
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('includes a non-empty body when unfinished habits remain', async () => {
      const mod = freshModule(true);

      await mod.scheduleEndOfDayReminder(true, '20:30', 1);

      const [call] = mockScheduleNotificationAsync.mock.calls;
      expect(call[0].content.body).not.toBe('');
    });
  });

  describe('cancelAllHabitReminders', () => {
    it('cancels both habit-prefixed reminders and the evening check-in', async () => {
      const mod = freshModule(true);
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'habit-reminder-h1-2025-01-01' },
        { identifier: 'cal-reminder-something' },
      ]);

      await mod.cancelAllHabitReminders();

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'habit-reminder-h1-2025-01-01',
      );
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-reminder-eod');
      expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'cal-reminder-something',
      );
    });
  });
});
