/**
 * Regression guard for the tracker-name typing bug.
 *
 * Every keystroke in the editor's name field re-renders TrackerEditorDialog.
 * If the form's heavy children re-render with it, each character rebuilds the
 * 64-cell icon grid (64 interpolated a11y labels) and the whole habit-fields
 * subtree. That work on the JS thread is what let the controlled TextInput fall
 * behind the native Android input and duplicate text — typing slowly was the
 * only workaround.
 *
 * These children take referentially stable props, so re-rendering them is pure
 * waste. The assertions below fail if that memoization is ever removed, or if a
 * caller passes an inline callback that silently defeats it.
 */
import React, { type ReactElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Render counter. Every component under test calls `useTranslation` or
 * `useTheme` (or both) exactly once per render, so counting those hook calls
 * counts renders — including nested children, which is what we want: if a
 * parent bails out, nothing beneath it renders either.
 */
let renderHookCalls = 0;

// Only the counted hook is replaced in each module; everything else stays real
// (src/i18n calls initReactI18next at import time, and Paper's exports are used
// throughout the components under test).
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    useTranslation: (...args: unknown[]) => {
      renderHookCalls += 1;
      return actual.useTranslation(...args);
    },
  };
});

jest.mock('react-native-paper', () => {
  const actual = jest.requireActual('react-native-paper');
  return {
    ...actual,
    useTheme: (...args: unknown[]) => {
      renderHookCalls += 1;
      return actual.useTheme(...args);
    },
  };
});

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const IconPickerField =
  require('../src/components/trackerEditor/IconPickerField').default;
const CounterEditorFields =
  require('../src/components/trackerEditor/CounterEditorFields').default;
const HabitEditorFields =
  require('../src/components/trackerEditor/HabitEditorFields').default;
const MonthPicker = require('../src/screens/nutrition/MonthPicker').default;
const { newEditorSession } =
  require('../src/components/trackerEditor/trackerEditorSession') as {
    newEditorSession: (opts: { mode: 'habit' | 'counter' }) => Record<string, unknown>;
  };
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

const noop = () => undefined;

/**
 * Mount `child`, then simulate `keystrokes` characters landing in a sibling
 * field, and report renders during mount vs. during typing.
 *
 * The child element is rebuilt on every parent render — exactly as the real
 * dialog does — so only real memoization can stop the subtree re-rendering.
 * Props come from a frozen object so their identity is stable, matching the
 * dialog's `useState` setters and `useCallback` handler.
 */
function measureTyping(
  Component: React.ComponentType<Record<string, unknown>>,
  props: Record<string, unknown>,
  keystrokes: number,
): { mount: number; whileTyping: number } {
  const Harness = ({ typed }: { typed: string }) =>
    React.createElement(
      React.Fragment,
      null,
      // Stands in for the name field's own value, which must change per key.
      React.createElement(React.Fragment, { key: 'typed' }, typed),
      React.createElement(Component, props) as ReactElement,
    );

  let tree!: ReactTestRenderer;
  renderHookCalls = 0;
  act(() => {
    tree = TestRenderer.create(React.createElement(Harness, { typed: '' }));
  });
  const mount = renderHookCalls;

  renderHookCalls = 0;
  let typed = '';
  for (let i = 0; i < keystrokes; i += 1) {
    typed += 'a';
    const next = typed;
    act(() => {
      tree.update(React.createElement(Harness, { typed: next }));
    });
  }
  const whileTyping = renderHookCalls;

  act(() => {
    tree.unmount();
  });
  return { mount, whileTyping };
}

const habitSession = newEditorSession({ mode: 'habit' });
const habitState = Object.freeze({
  targetLabel: habitSession.targetLabel,
  habitTrackingMode: habitSession.habitTrackingMode,
  habitDailyGoalMinutes: habitSession.habitDailyGoalMinutes,
  habitSoundTrackId: habitSession.habitSoundTrackId,
  habitSoundPlaybackMode: habitSession.habitSoundPlaybackMode,
  useTimeRange: habitSession.useTimeRange,
  timeRangeStart: habitSession.timeRangeStart,
  timeRangeEnd: habitSession.timeRangeEnd,
  visibleOnlyInTimeRange: habitSession.visibleOnlyInTimeRange,
  scheduleType: habitSession.scheduleType,
  scheduleWeekdays: habitSession.scheduleWeekdays,
  scheduleInterval: habitSession.scheduleInterval,
  scheduleAnchorDate: habitSession.scheduleAnchorDate,
  useReminder: habitSession.useReminder,
  remindMinutesBefore: habitSession.remindMinutesBefore,
  showStreakOnCard: habitSession.showStreakOnCard,
});

const KEYSTROKES = 8;

describe('tracker editor form does not re-render while typing the name', () => {
  it('leaves the icon grid alone', () => {
    const result = measureTyping(IconPickerField, { value: null, onChange: noop }, KEYSTROKES);
    expect(result.mount).toBeGreaterThan(0);
    expect(result.whileTyping).toBe(0);
  });

  it('leaves the counter fields alone', () => {
    const result = measureTyping(
      CounterEditorFields,
      {
        increments: '5, 10',
        dailyTarget: '',
        showStreakOnCard: true,
        onIncrementsChange: noop,
        onDailyTargetChange: noop,
        onShowStreakOnCardChange: noop,
      },
      KEYSTROKES,
    );
    expect(result.mount).toBeGreaterThan(0);
    expect(result.whileTyping).toBe(0);
  });

  it('leaves the habit fields alone', () => {
    const result = measureTyping(
      HabitEditorFields,
      { state: habitState, onChange: noop },
      KEYSTROKES,
    );
    expect(result.mount).toBeGreaterThan(0);
    expect(result.whileTyping).toBe(0);
  });
});

/**
 * The ingredient editor is one flat component, so a keystroke in any of its
 * eight fields re-renders everything. MonthPicker is the heavy extractable
 * child — two instances, twelve toggles each.
 */
describe('ingredient editor month pickers do not re-render while typing', () => {
  const SEASON_MONTHS = Object.freeze([3, 4, 5]);

  it('leaves the season picker alone', () => {
    const result = measureTyping(
      MonthPicker,
      { selected: SEASON_MONTHS, onToggle: noop, label: 'Season' },
      KEYSTROKES,
    );
    expect(result.mount).toBeGreaterThan(0);
    expect(result.whileTyping).toBe(0);
  });

  it('leaves the peak picker alone', () => {
    const result = measureTyping(
      MonthPicker,
      { selected: SEASON_MONTHS, allowed: SEASON_MONTHS, onToggle: noop, label: 'Peak' },
      KEYSTROKES,
    );
    expect(result.mount).toBeGreaterThan(0);
    expect(result.whileTyping).toBe(0);
  });
});
