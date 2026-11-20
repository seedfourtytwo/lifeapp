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

import { stopWidgetTimer } from 'life-widget';
import {
  attachConfirmHost,
  settleConfirm,
  type SheetRequest,
} from '../src/components/sheet/confirm';
import { startHabitTimerSession } from '../src/kinds/habit/habitTimerControls';
import { isTimerRunningInWidget, useEventStore } from '../src/store/eventStore';

const stopWidget = stopWidgetTimer as jest.Mock;
const runningInWidget = isTimerRunningInWidget as jest.Mock;
const startHabitTimer = jest.fn();
const config = {} as HabitConfig;

/** Every sheet the app asked for, in order — the stand-in for ConfirmHost. */
let asked: SheetRequest[] = [];
let detach: () => void = () => undefined;

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function openPrompt(): Promise<SheetRequest> {
  startHabitTimerSession('h1', config);
  await flush();
  expect(asked).toHaveLength(1);
  return asked[0];
}

async function answer(confirmed: boolean): Promise<void> {
  settleConfirm(confirmed);
  await flush();
}

describe('taking a habit timer over from the widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asked = [];
    detach = attachConfirmHost((request) => {
      if (request) asked.push(request);
    });
    (useEventStore.getState as jest.Mock).mockReturnValue({
      activeTimerSessions: {},
      startHabitTimer,
    });
    runningInWidget.mockResolvedValue(true);
    stopWidget.mockResolvedValue(undefined);
  });

  afterEach(() => detach());

  it('asks before taking over, starting nothing yet', async () => {
    const prompt = await openPrompt();

    expect(prompt).toMatchObject({
      kind: 'confirm',
      confirmLabel: 'trackers:habitWidget.timerRunningInWidgetTakeOver',
    });
    expect(stopWidget).not.toHaveBeenCalled();
    expect(startHabitTimer).not.toHaveBeenCalled();
  });

  it('cancel starts nothing and leaves the widget alone', async () => {
    await openPrompt();
    await answer(false);

    expect(stopWidget).not.toHaveBeenCalled();
    expect(startHabitTimer).not.toHaveBeenCalled();
  });

  it('confirm stops the widget timer, then starts the app timer', async () => {
    await openPrompt();
    runningInWidget.mockResolvedValue(false);
    await answer(true);

    expect(stopWidget).toHaveBeenCalledWith('h1');
    expect(startHabitTimer).toHaveBeenCalledWith('h1');
    expect(stopWidget.mock.invocationCallOrder[0]).toBeLessThan(
      startHabitTimer.mock.invocationCallOrder[0],
    );
  });

  it('starts nothing when the widget timer survives the stop call', async () => {
    await openPrompt();
    await answer(true);

    expect(stopWidget).toHaveBeenCalledWith('h1');
    expect(startHabitTimer).not.toHaveBeenCalled();
    expect(asked).toHaveLength(2);
    expect(asked[1]).toMatchObject({
      kind: 'notify',
      message: 'trackers:habitWidget.timerRunningInWidgetMessage',
    });
  });

  it('reports a failed stop and starts nothing', async () => {
    await openPrompt();
    stopWidget.mockRejectedValue(new Error('boom'));
    await answer(true);

    expect(startHabitTimer).not.toHaveBeenCalled();
    expect(asked).toHaveLength(2);
    expect(asked[1]).toMatchObject({ kind: 'notify', message: 'boom' });
  });
});
