/**
 * A stand-in for the expo-notifications JS module that remembers what was
 * scheduled, the way the phone's scheduler does: scheduling an identifier that
 * is already pending replaces it, cancelling removes it, and the pending list
 * is what `getAllScheduledNotificationsAsync` hands back.
 *
 * Use it as the module itself, so everything above the native boundary is the
 * app's real code:
 *
 *   jest.mock('expo-notifications', () =>
 *     require('./support/fakeNotifications').createFakeNotifications());
 *
 * and after `jest.resetModules()` read the fresh instance back with
 * `require('expo-notifications') as FakeNotifications`.
 */

export type FakeTrigger = {
  type: string;
  date?: Date | number;
  hour?: number;
  minute?: number;
  channelId?: string;
};

export type FakeRequest = {
  identifier: string;
  content: { title?: string; body?: string };
  trigger: FakeTrigger;
};

export type FakePermission = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
};

const GRANTED: FakePermission = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
};

export function permission(
  status: FakePermission['status'],
  canAskAgain = true,
): FakePermission {
  return { status, granted: status === 'granted', canAskAgain, expires: 'never' };
}

export function createFakeNotifications() {
  const pending = new Map<string, FakeRequest>();
  const channels = new Map<string, { name: string; importance: number }>();
  const state = {
    permission: GRANTED,
    /** What a permission prompt answers with. */
    answer: GRANTED,
  };

  const fake = {
    pending,
    channels,
    state,
    /** Pending requests in fire order, for readable assertions. */
    scheduledList(): FakeRequest[] {
      return [...pending.values()].sort((a, b) => fireMs(a) - fireMs(b));
    },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(
      async (id: string, channel: { name: string; importance: number }) => {
        channels.set(id, channel);
        return { id, ...channel };
      },
    ),
    scheduleNotificationAsync: jest.fn(async (request: FakeRequest) => {
      pending.set(request.identifier, request);
      return request.identifier;
    }),
    cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
      pending.delete(identifier);
    }),
    // Hands back what the Android module does: a DATE trigger comes back as
    // { type: 'date', repeats: false, value: <ms>, channelId }, not as it went in.
    getAllScheduledNotificationsAsync: jest.fn(async () =>
      [...pending.values()].map((request) => ({
        identifier: request.identifier,
        content: { title: request.content.title ?? null, body: request.content.body ?? null },
        trigger:
          request.trigger.type === 'date'
            ? {
                type: 'date',
                repeats: false,
                value: fireMs(request),
                channelId: request.trigger.channelId ?? null,
              }
            : { ...request.trigger },
      })),
    ),
    getPermissionsAsync: jest.fn(async () => state.permission),
    requestPermissionsAsync: jest.fn(async () => {
      state.permission = state.answer;
      return state.permission;
    }),
    SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
    AndroidImportance: { DEFAULT: 5, HIGH: 6 },
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
  };
  return fake;
}

export type FakeNotifications = ReturnType<typeof createFakeNotifications>;

export function fireMs(request: FakeRequest): number {
  const { date } = request.trigger;
  if (date === undefined) return Number.POSITIVE_INFINITY;
  return typeof date === 'number' ? date : date.getTime();
}
