/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
/**
 * Settings → Notifications: the evening check-in, the habit reminder master
 * switch, and the line that offers to ask again when the phone has
 * notifications turned off for Life. The real stores and permission code run
 * against the faked expo-notifications module.
 */
import type { ReactTestRenderer } from 'react-test-renderer';
import { habitElement } from './support/elements';
import type { FakeNotifications } from './support/fakeNotifications';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);
jest.mock('../src/db/client', () => ({ getDatabase: jest.fn() }));

type Settings = typeof import('../src/store/settingsStore').useSettingsStore;
type Permission = typeof import('../src/store/notificationPermissionStore').useNotificationPermissionStore;

let fake: FakeNotifications;
let settings: Settings;
let permissionStore: Permission;
let permission: typeof import('./support/fakeNotifications').permission;
let openSettings: jest.SpyInstance;

beforeEach(() => {
  jest.resetModules();
  fake = require('expo-notifications');
  permission = require('./support/fakeNotifications').permission;
  settings = require('../src/store/settingsStore').useSettingsStore;
  permissionStore = require('../src/store/notificationPermissionStore').useNotificationPermissionStore;
  openSettings = jest
    .spyOn(require('react-native').Linking, 'openSettings')
    .mockResolvedValue(undefined);
  settings.setState({
    isLoaded: true,
    eveningCheckInEnabled: true,
    eveningCheckInTime: '20:00',
    trackerRemindersEnabled: true,
    setEveningCheckInEnabled: jest.fn(async () => undefined),
    setEveningCheckInTime: jest.fn(async () => undefined),
    setTrackerRemindersEnabled: jest.fn(async () => undefined),
  });
});

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

/** React and the renderer come from the same fresh registry as the components. */
let act: typeof import('react-test-renderer').act;

async function mount(): Promise<ReactTestRenderer> {
  const React: typeof import('react') = require('react');
  const TestRenderer: typeof import('react-test-renderer') = require('react-test-renderer');
  act = TestRenderer.act;
  const { PaperProvider } = require('react-native-paper');
  const { appLightTheme } = require('../src/theme/themes');
  const Section = require('../src/screens/settings/NotificationSettingsSection').default;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(PaperProvider, { theme: appLightTheme, children: React.createElement(Section) }),
    );
    await flush();
  });
  return renderer;
}

function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string);
}

function pressable(renderer: ReactTestRenderer, label: string) {
  const [hit] = renderer.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  );
  if (!hit) throw new Error(`Nothing labelled ${label}`);
  return hit;
}

type TimeField = { value: string; onChangeText: (text: string) => void; onEndEditing: () => void };

function timeField(renderer: ReactTestRenderer): TimeField {
  return renderer.root.find(
    (n) => n.props.accessibilityLabel === 'Check-in time' && Boolean(n.props.onChangeText),
  ).props as TimeField;
}

async function press(renderer: ReactTestRenderer, label: string): Promise<void> {
  await act(async () => {
    (pressable(renderer, label).props.onPress as () => void)();
    await flush();
  });
}

it('switches the evening check-in off', async () => {
  const renderer = await mount();

  await press(renderer, 'Evening check-in');

  expect(settings.getState().setEveningCheckInEnabled).toHaveBeenCalledWith(false);
});

it('saves a new check-in time as HH:mm', async () => {
  const renderer = await mount();
  const field = timeField(renderer);

  await act(async () => {
    field.onChangeText('2130');
  });
  await act(async () => {
    timeField(renderer).onEndEditing();
    await flush();
  });

  expect(settings.getState().setEveningCheckInTime).toHaveBeenCalledWith('21:30');
});

it('refuses a check-in time that is not a time, and keeps the old one', async () => {
  const renderer = await mount();
  const field = () => timeField(renderer);

  await act(async () => {
    field().onChangeText('25:99');
  });
  await act(async () => {
    field().onEndEditing();
    await flush();
  });

  expect(settings.getState().setEveningCheckInTime).not.toHaveBeenCalled();
  expect(field().value).toBe('20:00');
});

it('hides the time while the check-in is off', async () => {
  settings.setState({ eveningCheckInEnabled: false });
  const renderer = await mount();

  expect(renderer.root.findAll((n) => n.props.accessibilityLabel === 'Check-in time')).toEqual([]);
});

it('switches habit reminders off', async () => {
  const renderer = await mount();

  await press(renderer, 'Habit reminders');

  expect(settings.getState().setTrackerRemindersEnabled).toHaveBeenCalledWith(false);
});

it('says nothing about permission while notifications are allowed', async () => {
  const renderer = await mount();

  expect(texts(renderer)).not.toContain('Notifications are off for Life');
});

it('offers to ask again when notifications are denied, and asks', async () => {
  fake.state.permission = permission('denied', true);
  const renderer = await mount();
  expect(texts(renderer)).toContain('Notifications are off for Life');

  await press(renderer, 'Allow notifications');

  expect(fake.requestPermissionsAsync).toHaveBeenCalled();
  expect(permissionStore.getState().permission?.status).toBe('granted');
  expect(texts(renderer)).not.toContain('Notifications are off for Life');
});

it('sends the user to system settings when the phone will not ask again', async () => {
  fake.state.permission = permission('denied', false);
  fake.state.answer = permission('denied', false);
  const renderer = await mount();

  await press(renderer, 'Allow notifications');

  expect(fake.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(openSettings).toHaveBeenCalled();
});

it('re-syncs habit reminders once permission is granted', async () => {
  fake.state.permission = permission('denied', true);
  fake.state.answer = permission('denied', true);
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  try {
    require('../src/store/elementStore').useElementStore.setState({
      isLoaded: true,
      elements: [
        habitElement({
          id: '550e8400-e29b-41d4-a716-446655440971',
          name: 'Burp the kefir',
          createdAt: '2026-01-01T08:00:00.000Z',
          config: { reminderTimes: ['09:00'] },
        }),
      ],
    });
    const stop = require('../src/hooks/useHabitReminderSync').watchHabitReminders();
    await flush();
    expect(fake.pending.size).toBe(0);

    fake.state.answer = permission('granted');
    await permissionStore.getState().request();
    await jest.advanceTimersByTimeAsync(2000);
    await flush();
    stop();

    expect(fake.pending.size).toBeGreaterThan(0);
  } finally {
    jest.useRealTimers();
  }
}, 20_000);
