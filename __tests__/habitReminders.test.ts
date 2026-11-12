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
  setNotificationChannelAsync: jest.fn(async () => null),
  AndroidImportance: { HIGH: 6 },
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  IosAuthorizationStatus: { PROVISIONAL: 'provisional' },
}));

/**
 * jest-expo registers the same native modules expo-notifications does, so
 * "available" is the real lookup. "Unavailable" is a dev client built without
 * expo-notifications: the scheduler module is simply not registered.
 */
function hideNotificationScheduler(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
  const core = require('expo-modules-core') as typeof import('expo-modules-core');
  const lookup = core.requireOptionalNativeModule;
  jest
    .spyOn(core, 'requireOptionalNativeModule')
    .mockImplementation((name: string) => (name === 'ExpoNotificationScheduler' ? null : lookup(name)));
}

/** habitReminders.native.ts has closure-scoped singleton state — reset per test for isolation. */
function freshModule(available: boolean): typeof import('../src/notifications/habitReminders.native') {
  jest.resetModules();
  if (!available) hideNotificationScheduler();
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
    it('reflects whether the notification scheduler native module is registered', () => {
      expect(freshModule(true).isNotificationsNativeAvailable()).toBe(true);
      expect(freshModule(false).isNotificationsNativeAvailable()).toBe(false);
    });

    it('finds the scheduler under the new architecture, where NativeModules has no Expo modules', () => {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
      const { NativeModules } = require('react-native');
      expect(NativeModules.ExpoPushTokenManager).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
      const mod = require('../src/notifications/habitReminders.native') as typeof import('../src/notifications/habitReminders.native');
      expect(mod.isNotificationsNativeAvailable()).toBe(true);
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
      expect(call[0].trigger).toEqual({
        type: 'daily',
        hour: 20,
        minute: 30,
        channelId: 'reminders',
      });
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

  describe('cancelHabitStartReminders', () => {
    it('cancels the habit reminders the old scheduler queued, and keeps the evening check-in', async () => {
      const mod = freshModule(true);
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'habit-reminder-h1-2025-01-01-0900' },
        { identifier: 'habit-reminder-eod' },
        { identifier: 'cal-reminder-something' },
      ]);

      await mod.cancelHabitStartReminders();

      expect(mockCancelScheduledNotificationAsync.mock.calls).toEqual([
        ['habit-reminder-h1-2025-01-01-0900'],
      ]);
    });
  });
});
