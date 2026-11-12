/**
 * Time and date fields: on the phone they open Android's own picker and
 * never show a text box; off the phone (web, these tests) a typed fallback.
 * What they show follows the app language for days and months, and the
 * 24-hour clock for times.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { applyAppLanguage } from '../src/i18n';
import { DateField } from '../src/ui/DateField';
import {
  dateAsDay,
  dateAsTime,
  dayAsDate,
  formatPickedDate,
  formatPickedTime,
  parseTypedDate,
  timeAsDate,
} from '../src/ui/pickerFormat';
import { TimeField } from '../src/ui/TimeField';

describe('what the fields show', () => {
  afterEach(async () => {
    await applyAppLanguage('en');
  });

  it('shows a time on the 24-hour clock, and nothing for a broken one', () => {
    expect(formatPickedTime('07:30')).toBe('07:30');
    expect(formatPickedTime('21:00')).toBe('21:00');
    expect(formatPickedTime('7:3')).toBe('07:03');
    expect(formatPickedTime('25:00')).toBe('');
  });

  it('names the day in the app language, with the year only when it is not this one', async () => {
    expect(formatPickedDate('2026-11-11', '2026-11-12')).toBe('Wed, Nov 11');
    expect(formatPickedDate('2025-11-11', '2026-11-12')).toBe('Tue, Nov 11, 2025');
    await applyAppLanguage('fr');
    expect(formatPickedDate('2026-11-11', '2026-11-12')).toBe('mer. 11 nov.');
  });

  it('shows nothing for a date that is not one', () => {
    expect(formatPickedDate('soon', '2026-11-12')).toBe('');
  });
});

describe('to and from the picker', () => {
  const now = new Date(2026, 10, 12, 9, 41, 17);

  it('opens on the set time today, or on the hour when none is set', () => {
    const at = timeAsDate('21:05', now);
    expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([21, 5, 0]);
    const blank = timeAsDate(null, now);
    expect([blank.getHours(), blank.getMinutes()]).toEqual([9, 0]);
    expect(timeAsDate('nonsense', now).getMinutes()).toBe(0);
    expect(dateAsTime(new Date(2026, 0, 1, 6, 7))).toBe('06:07');
  });

  it('opens on the set day, or today, and stores the local day picked', () => {
    expect(dateAsDay(dayAsDate('2026-02-28', '2026-11-12'))).toBe('2026-02-28');
    expect(dateAsDay(dayAsDate(null, '2026-11-12'))).toBe('2026-11-12');
    expect(dateAsDay(dayAsDate('nope', '2026-11-12'))).toBe('2026-11-12');
    expect(dateAsDay(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('takes a typed date only when it is a real day', () => {
    expect(parseTypedDate(' 2026-02-28 ')).toBe('2026-02-28');
    expect(parseTypedDate('2026-02-30')).toBeNull();
    expect(parseTypedDate('28/02/2026')).toBeNull();
  });
});

let tree: ReactTestRenderer | null = null;
function render(element: React.ReactElement): ReactTestInstance {
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree!.root;
}
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

function inputs(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll((node) => node.type === 'TextInput');
}

describe('on the phone', () => {
  const realOS = Platform.OS;
  let open: jest.SpyInstance;
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    open = jest.spyOn(DateTimePickerAndroid, 'open').mockImplementation(() => undefined);
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => realOS });
    open.mockRestore();
  });

  type Answer = { type: 'set' | 'dismissed' };
  function answer(event: Answer, picked?: Date) {
    const args = open.mock.calls[0]![0] as { onChange: (e: Answer, d?: Date) => void };
    return act(async () => {
      args.onChange(event, picked);
    });
  }

  function pressField(root: ReactTestInstance, label: string) {
    const field = root.findAll((node) => typeof node.props.onPress === 'function' && String(node.props.accessibilityLabel).startsWith(label))[0]!;
    act(() => (field.props.onPress as () => void)());
  }

  it('shows no text box, opens the 24-hour clock on the set time, and stores what was set', async () => {
    const onChange = jest.fn();
    const root = render(React.createElement(TimeField, { label: 'Reminder', value: '07:30', onChange }));
    expect(inputs(root)).toEqual([]);
    pressField(root, 'Reminder');
    const args = open.mock.calls[0]![0] as { mode: string; is24Hour: boolean; value: Date };
    expect(args.mode).toBe('time');
    expect(args.is24Hour).toBe(true);
    expect([args.value.getHours(), args.value.getMinutes()]).toEqual([7, 30]);
    await answer({ type: 'set' }, new Date(2026, 10, 12, 21, 15));
    expect(onChange).toHaveBeenCalledWith('21:15');
  });

  it('keeps the time when the clock is dismissed', async () => {
    const onChange = jest.fn();
    const root = render(React.createElement(TimeField, { label: 'Reminder', value: '07:30', onChange }));
    pressField(root, 'Reminder');
    await answer({ type: 'dismissed' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens the calendar inside its bounds and stores the day picked', async () => {
    const onChange = jest.fn();
    const root = render(
      React.createElement(DateField, { label: 'Clear since', value: '2026-11-01', maximumDate: '2026-11-12', onChange }),
    );
    expect(inputs(root)).toEqual([]);
    pressField(root, 'Clear since');
    const args = open.mock.calls[0]![0] as { mode: string; maximumDate: Date; minimumDate?: Date };
    expect(args.mode).toBe('date');
    expect(dateAsDay(args.maximumDate)).toBe('2026-11-12');
    expect(args.minimumDate).toBeUndefined();
    await answer({ type: 'set' }, new Date(2026, 10, 3, 12));
    expect(onChange).toHaveBeenCalledWith('2026-11-03');
  });
});

describe('off the phone', () => {
  function type(root: ReactTestInstance, text: string) {
    const input = inputs(root)[0]!;
    act(() => (input.props.onChangeText as (t: string) => void)(text));
    act(() => (inputs(root)[0]!.props.onBlur as () => void)());
  }

  it('falls back to typing a time, and keeps the old one for a broken entry', () => {
    const onChange = jest.fn();
    const root = render(React.createElement(TimeField, { label: 'Reminder', value: '07:30', onChange }));
    expect(inputs(root)).toHaveLength(1);
    type(root, '630');
    expect(onChange).toHaveBeenCalledWith('06:30');
    type(root, '99:99');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(inputs(root)[0]!.props.value).toBe('07:30');
  });

  it('falls back to typing a date, inside its bounds', () => {
    const onChange = jest.fn();
    const root = render(React.createElement(DateField, { label: 'Day', value: null, maximumDate: '2026-11-12', onChange }));
    type(root, '2026-12-01');
    expect(onChange).not.toHaveBeenCalled();
    type(root, '2026-11-02');
    expect(onChange).toHaveBeenCalledWith('2026-11-02');
  });
});
