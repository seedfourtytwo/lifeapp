/**
 * The Done control on a timed habit's card. Chris could not finish a
 * 15-minute meditation stuck at 7:39: Done only appeared past the goal, and
 * never for a play-once track. It is there now whenever the timer runs or is
 * paused, and on a day with time logged that is not done yet.
 */
import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { HabitTimerWidget } from '../src/kinds/habit/HabitTimerWidget';
import { TrackerCardRoundButton } from '../src/kinds/TrackerCardRoundButton';
import { TrackerCardTick } from '../src/kinds/TrackerCardTick';
import { createActiveTimerSession, type ActiveTimerSession } from '../src/protocol';
import { appLightTheme } from '../src/theme/themes';
import { habitElement } from './support/elements';

jest.mock('../src/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    themeMode: 'light',
    decorations: {
      borderWidth: 1.5,
      radius: { sm: 8, md: 14, lg: 20 },
      tabRadius: 14,
      progressHeight: 4,
      buttonRadius: 999,
    },
  }),
}));

const meditate = habitElement({
  id: '550e8400-e29b-41d4-a716-446655440b01',
  name: 'Meditate',
  config: { trackingMode: 'timer', dailyTargetSeconds: 900 },
});
const playOnce = habitElement({
  id: '550e8400-e29b-41d4-a716-446655440b02',
  name: 'Wim Hof',
  config: { trackingMode: 'timer', timerSound: { trackId: 'wimhofMorning', playbackMode: 'play_once' } },
});

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of mounted.splice(0)) tree.unmount();
  });
});

function render(props: {
  element?: typeof meditate;
  todayTotal?: number;
  isDone?: boolean;
  session?: ActiveTimerSession | null;
  isMarkedDone?: boolean;
  onUnmarkDone?: () => void;
}): ReactTestInstance {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(PaperProvider, {
        theme: appLightTheme,
        children: React.createElement(HabitTimerWidget, {
          element: props.element ?? meditate,
          todayTotal: props.todayTotal ?? 0,
          isDone: props.isDone ?? false,
          activeTimerSession: props.session ?? null,
          onTimerPress: () => {},
          onTimerFinish: () => {},
          isMarkedDone: props.isMarkedDone ?? false,
          onUnmarkDone: props.onUnmarkDone ?? (() => {}),
        }),
      }),
    );
  });
  mounted.push(tree);
  return tree.root;
}

const doneButton = (root: ReactTestInstance) =>
  root.findAllByType(TrackerCardRoundButton).find((b) => b.props.icon === 'check');

describe('Done on a timed habit', () => {
  it('is offered on a running timer short of its goal, and marks the day', () => {
    const button = doneButton(render({ session: createActiveTimerSession() }));
    expect(button?.props.accessibilityLabel).toBe('Mark habit done');
  });

  it('is offered on a paused timer', () => {
    const paused = { ...createActiveTimerSession(), pausedAt: new Date().toISOString() };
    expect(doneButton(render({ todayTotal: 459, session: paused }))).toBeDefined();
  });

  it('is offered on a partly done day with no timer running', () => {
    expect(doneButton(render({ todayTotal: 459 }))).toBeDefined();
  });

  it('is offered on a running play-once track', () => {
    expect(doneButton(render({ element: playOnce, session: createActiveTimerSession() }))).toBeDefined();
  });

  it('is not offered before anything is logged, or once the day is done', () => {
    expect(doneButton(render({}))).toBeUndefined();
    expect(doneButton(render({ todayTotal: 459, isDone: true }))).toBeUndefined();
    expect(doneButton(render({ todayTotal: 900, isDone: true }))).toBeUndefined();
  });

  it('only finishes the session once the goal is already met', () => {
    const button = doneButton(render({ todayTotal: 900, isDone: true, session: createActiveTimerSession() }));
    expect(button?.props.accessibilityLabel).toBe('Finish timer session');
  });
});

const unmarkTick = (root: ReactTestInstance) => root.findAllByType(TrackerCardTick)[0];

describe('un-marking a day done with Done', () => {
  it('shows a filled tick on a day done only by Done, with no timer running', () => {
    const tick = unmarkTick(render({ todayTotal: 459, isDone: true, isMarkedDone: true }));
    expect(tick?.props.done).toBe(true);
    expect(tick?.props.accessibilityLabel).toBe('Marked done, tap to undo');
    expect(doneButton(render({ todayTotal: 459, isDone: true, isMarkedDone: true }))).toBeUndefined();
  });

  it('shows nothing to un-mark on a day whose goal was really met', () => {
    expect(unmarkTick(render({ todayTotal: 900, isDone: true }))).toBeUndefined();
    expect(
      unmarkTick(render({ element: playOnce, todayTotal: 1340, isDone: true })),
    ).toBeUndefined();
  });

  it('shows no tick while a timer runs on a marked day; Done banks the session', () => {
    const root = render({ todayTotal: 459, isDone: true, isMarkedDone: true, session: createActiveTimerSession() });
    expect(unmarkTick(root)).toBeUndefined();
    expect(doneButton(root)).toBeDefined();
  });

  it('un-marks on press, and the partly done day gets its Done button back', () => {
    const onUnmarkDone = jest.fn();
    const tick = unmarkTick(render({ todayTotal: 459, isDone: true, isMarkedDone: true, onUnmarkDone }));
    act(() => (tick?.props.onPress as () => void)());
    expect(onUnmarkDone).toHaveBeenCalledTimes(1);

    // What the store holds after the un-mark: the seconds, not done, no mark.
    const after = render({ todayTotal: 459, isDone: false, isMarkedDone: false });
    expect(unmarkTick(after)).toBeUndefined();
    expect(doneButton(after)?.props.accessibilityLabel).toBe('Mark habit done');
  });
});
