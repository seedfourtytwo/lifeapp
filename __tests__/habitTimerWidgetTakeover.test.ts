/* eslint-disable import/first -- jest mocks must load before module imports */
import type { HabitConfig } from '../src/protocol';

jest.mock('life-widget', () => ({ stopWidgetTimer: jest.fn() }));
jest.mock('../src/i18n', () => ({ i18n: { t: (key: string) => key } }));
jest.mock('../src/audio/habitTimerSound', () => ({
  pauseHabitSound: jest.fn(),
  playHabitSound: jest.fn(() => Promise.resolve()),
  resumeHabitSound: jest.fn(),
  stopHabitSound: jest.fn(() => Promise.resolve()),
}));
jest.mock('../src/store/elementStore', () => ({
  useElementStore: { getState: () => ({ elements: [] }) },
}));
jest.mock('../src/store/eventStore', () => ({
  isTimerRunningInWidget: jest.fn(),
  whenActiveTimersReady: jest.fn(() => Promise.resolve()),
  useEventStore: {
    getState: jest.fn(),
  },
}));
jest.mock('../src/kinds/habit/habitLockScreenQueue', () => ({
  getFocusedHabitId: jest.fn(),
  peekAdjacentHabit: jest.fn(),
  setFocusedHabitId: jest.fn(),
}));
jest.mock('../src/kinds/habit/habitTimerPresentation', () => ({
  lockScreenMetaFor: jest.fn(),
  presentFocusedHabitReady: jest.fn(),
  refreshLockScreenTicker: jest.fn(),
}));
jest.mock('../src/kinds/habit/habitTimerLockScreen', () => ({
  stopHabitTimerLockScreenTicker: jest.fn(),
}));

import { Alert, type AlertButton } from 'react-native';
import { stopWidgetTimer } from 'life-widget';
import { startHabitTimerSession } from '../src/kinds/habit/habitTimerControls';
import { isTimerRunningInWidget, useEventStore } from '../src/store/eventStore';

const stopWidget = stopWidgetTimer as jest.Mock;
const runningInWidget = isTimerRunningInWidget as jest.Mock;
const startHabitTimer = jest.fn();
const config = {} as HabitConfig;

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function openPrompt(): Promise<AlertButton[]> {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  startHabitTimerSession('h1', config);
  await flush();
  expect(alert).toHaveBeenCalledTimes(1);
  return alert.mock.calls[0][2] as AlertButton[];
}

describe('taking a habit timer over from the widget', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (useEventStore.getState as jest.Mock).mockReturnValue({
      activeTimerSessions: {},
      startHabitTimer,
    });
    runningInWidget.mockResolvedValue(true);
    stopWidget.mockResolvedValue(undefined);
  });

  it('offers cancel and a confirm button, starting nothing yet', async () => {
    const buttons = await openPrompt();

    expect(buttons).toHaveLength(2);
    expect(buttons[0].style).toBe('cancel');
    expect(stopWidget).not.toHaveBeenCalled();
    expect(startHabitTimer).not.toHaveBeenCalled();
  });

  it('cancel starts nothing and leaves the widget alone', async () => {
    const buttons = await openPrompt();
    buttons[0].onPress?.();
    await flush();

    expect(stopWidget).not.toHaveBeenCalled();
    expect(startHabitTimer).not.toHaveBeenCalled();
  });

  it('confirm stops the widget timer, then starts the app timer', async () => {
    const buttons = await openPrompt();
    runningInWidget.mockResolvedValue(false);
    buttons[1].onPress?.();
    await flush();

    expect(stopWidget).toHaveBeenCalledWith('h1');
    expect(startHabitTimer).toHaveBeenCalledWith('h1');
    expect(stopWidget.mock.invocationCallOrder[0]).toBeLessThan(
      startHabitTimer.mock.invocationCallOrder[0],
    );
  });

  it('starts nothing when the widget timer survives the stop call', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    startHabitTimerSession('h1', config);
    await flush();
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    buttons[1].onPress?.();
    await flush();

    expect(stopWidget).toHaveBeenCalledWith('h1');
    expect(startHabitTimer).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[1][1]).toBe('trackers:habitWidget.timerRunningInWidgetMessage');
  });

  it('reports a failed stop and starts nothing', async () => {
    const buttons = await openPrompt();
    stopWidget.mockRejectedValue(new Error('boom'));
    buttons[1].onPress?.();
    await flush();

    expect(startHabitTimer).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(2);
  });
});
