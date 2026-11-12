/**
 * The kit's controls say their state to a screen reader as well as drawing
 * it, take a press as a whole control, and hand back what was chosen.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import '../src/i18n';
import { Chip } from '../src/ui/Chip';
import { Divider } from '../src/ui/Divider';
import { Dock } from '../src/ui/Dock';
import { Field } from '../src/ui/Field';
import { GlassSurface } from '../src/ui/GlassSurface';
import { PillButton } from '../src/ui/PillButton';
import { ProgressLine } from '../src/ui/ProgressLine';
import { RoundButton } from '../src/ui/RoundButton';
import { Row } from '../src/ui/Row';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Section } from '../src/ui/Section';
import { Segmented } from '../src/ui/Segmented';
import { TextButton } from '../src/ui/TextButton';
import { Toggle } from '../src/ui/Toggle';
import { WeekDashes } from '../src/ui/WeekDashes';
import { nightColors } from '../src/ui/tokens';

let tree: ReactTestRenderer | null = null;

function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

/** Mounted, with the reduce-motion query and the icon font settled. */
async function render(element: React.ReactElement): Promise<ReactTestInstance> {
  await act(async () => {
    tree = TestRenderer.create(element);
  });
  return tree!.root;
}

afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

/** The host element a screen reader would land on for this label. */
function control(root: ReactTestInstance, label: string): ReactTestInstance {
  const found = root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityLabel === label && Boolean(node.props.accessibilityRole),
  );
  if (found.length === 0) throw new Error(`No control said as "${label}"`);
  return found[0]!;
}

/** A press as the host view gets it (an accessibility click), which honours `disabled`. */
function press(root: ReactTestInstance, label: string) {
  const onClick = control(root, label).props.onClick as unknown;
  expect(onClick).toEqual(expect.any(Function));
  act(() => (onClick as () => void)());
}

/** The control's own press handler. */
function tap(root: ReactTestInstance, label: string) {
  const node = root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label,
  )[0];
  if (!node) throw new Error(`Nothing to press said as "${label}"`);
  act(() => {
    (node.props.onPress as () => void)();
  });
}

describe('Segmented', () => {
  const options = [
    { value: 'check', label: 'Check-off' },
    { value: 'timer', label: 'Timer' },
  ] as const;

  it('says which one is chosen, as radios in a group', async () => {
    const root = await render(
      React.createElement(Segmented<'check' | 'timer'>, {
        options,
        value: 'timer',
        onChange: jest.fn(),
        accessibilityLabel: 'Type',
      }),
    );
    expect(control(root, 'Type').props.accessibilityRole).toBe('radiogroup');
    expect(control(root, 'Timer').props.accessibilityState).toMatchObject({ checked: true });
    expect(control(root, 'Check-off').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('hands back the other option, and nothing for the one already chosen', async () => {
    const onChange = jest.fn();
    const root = await render(
      React.createElement(Segmented<'check' | 'timer'>, { options, value: 'timer', onChange, accessibilityLabel: 'Type' }),
    );
    tap(root, 'Timer');
    expect(onChange).not.toHaveBeenCalled();
    tap(root, 'Check-off');
    expect(onChange).toHaveBeenCalledWith('check');
  });
});

describe('Chip', () => {
  it('says whether it is chosen, and only when it is a choice', async () => {
    const root = await render(
      React.createElement(React.Fragment, null, [
        React.createElement(Chip, { key: 'a', label: 'Every day', selected: true, onPress: jest.fn() }),
        React.createElement(Chip, { key: 'b', label: 'Pick days', selected: false, onPress: jest.fn() }),
        React.createElement(Chip, { key: 'c', label: '07:30', onPress: jest.fn() }),
      ]),
    );
    expect(control(root, 'Every day').props.accessibilityState).toMatchObject({ selected: true });
    expect(control(root, 'Pick days').props.accessibilityState).toMatchObject({ selected: false });
    expect(control(root, '07:30').props.accessibilityState).toEqual(expect.not.objectContaining({ selected: expect.anything() }));
  });

  it('draws the chosen one with a lit ring and the others with a quiet edge', async () => {
    const root = await render(
      React.createElement(React.Fragment, null, [
        React.createElement(Chip, { key: 'a', label: 'On', selected: true, light: 'amber', onPress: jest.fn() }),
        React.createElement(Chip, { key: 'b', label: 'Off', selected: false, onPress: jest.fn() }),
      ]),
    );
    const ring = (label: string) => flat(control(root, label).props.style).borderColor;
    expect(ring('On')).toBe(nightColors.amber);
    expect(ring('Off')).toBe(nightColors.quietEdge);
  });

  it('the "+" chip shows no words but is said by its label', async () => {
    const onPress = jest.fn();
    const root = await render(React.createElement(Chip, { add: true, accessibilityLabel: 'Add a reminder', onPress }));
    tap(root, 'Add a reminder');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(root.findAll((node) => node.type === 'Text' && node.props.children === 'Add a reminder')).toEqual([]);
  });
});

describe('Toggle', () => {
  it('is a switch that says on or off, and flips', async () => {
    const onValueChange = jest.fn();
    const root = await render(React.createElement(Toggle, { value: false, onValueChange, accessibilityLabel: 'Reminders' }));
    expect(control(root, 'Reminders').props.accessibilityRole).toBe('switch');
    expect(control(root, 'Reminders').props.accessibilityState).toMatchObject({ checked: false });
    press(root, 'Reminders');
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('says when it cannot be changed, and takes no press then', async () => {
    const onValueChange = jest.fn();
    const root = await render(React.createElement(Toggle, { value: true, onValueChange, accessibilityLabel: 'Weather', disabled: true }));
    expect(control(root, 'Weather').props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    press(root, 'Weather');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('buttons', () => {
  it('say when they are disabled and take no press then', async () => {
    const onPress = jest.fn();
    const root = await render(
      React.createElement(React.Fragment, null, [
        React.createElement(PillButton, { key: 'p', variant: 'primary', label: 'Save', onPress, disabled: true }),
        React.createElement(RoundButton, { key: 'r', icon: 'delete-outline', accessibilityLabel: 'Delete', onPress, disabled: true }),
        React.createElement(TextButton, { key: 't', label: 'Restore', onPress, disabled: true }),
      ]),
    );
    for (const label of ['Save', 'Delete', 'Restore']) {
      expect(control(root, label).props.accessibilityState).toMatchObject({ disabled: true });
      press(root, label);
    }
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a small round button still reaches the touch minimum through its slop', async () => {
    const root = await render(React.createElement(RoundButton, { icon: 'cog-outline', size: 'sm', accessibilityLabel: 'Settings', onPress: jest.fn() }));
    const host = control(root, 'Settings');
    const box = flat(host.props.style);
    expect(box.width).toBeGreaterThanOrEqual(48);
  });

  it('a round button with characters grows rather than clipping them', async () => {
    const root = await render(React.createElement(RoundButton, { label: '+10', accessibilityLabel: 'Add 10', onPress: jest.fn() }));
    const box = flat(control(root, 'Add 10').props.style);
    expect(box.width).toBeUndefined();
    expect(box.minWidth).toBeGreaterThanOrEqual(48);
  });

  it('a danger pill is ringed and worded in the danger colour', async () => {
    const root = await render(React.createElement(PillButton, { variant: 'danger', label: 'Erase', onPress: jest.fn() }));
    const box = flat(control(root, 'Erase').props.style);
    expect(box.borderColor).toBe(nightColors.danger);
    const words = root.findAll((node) => node.type === 'Text' && node.props.children === 'Erase')[0]!;
    expect(flat(words.props.style).color).toBe(nightColors.danger);
  });
});

describe('Dock', () => {
  it('lights and selects the place on screen, and never the "+"', async () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    const root = await render(
      React.createElement(Dock<'today' | 'road'>, {
        places: [
          { key: 'today', icon: 'calendar-today', label: 'Today' },
          { key: 'road', icon: 'road-variant', label: 'Road' },
        ],
        active: 'today',
        onSelect,
        action: { icon: 'plus', label: 'Add', onPress: onAdd },
      }),
    );
    expect(control(root, 'Today').props.accessibilityState).toMatchObject({ selected: true });
    expect(control(root, 'Road').props.accessibilityState).toMatchObject({ selected: false });
    expect(control(root, 'Add').props.accessibilityState).toEqual(expect.not.objectContaining({ selected: expect.anything() }));
    tap(root, 'Road');
    tap(root, 'Add');
    expect(onSelect).toHaveBeenCalledWith('road');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('Field', () => {
  it('shows a value and opens what changes it, said as label and value', async () => {
    const onPress = jest.fn();
    const root = await render(React.createElement(Field, { label: 'Goal', value: '15 min', onPress }));
    tap(root, 'Goal, 15 min');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('takes only digits in a number field', async () => {
    const onChangeText = jest.fn();
    const root = await render(React.createElement(Field, { label: 'Goal a day', value: '', onChangeText, numeric: true, unit: 'glasses' }));
    const input = root.findAll((node) => node.props.keyboardType === 'number-pad')[0]!;
    act(() => (input.props.onChangeText as (text: string) => void)('1a2.'));
    expect(onChangeText).toHaveBeenCalledWith('12');
  });
});

describe('rows, sections and tiles', () => {
  it('a row that opens something says its label and value as one button', async () => {
    const onPress = jest.fn();
    const root = await render(React.createElement(Row, { label: 'Language', value: 'English', chevron: true, onPress }));
    tap(root, 'Language, English');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a grouped section puts a divider between rows, not around them', async () => {
    const root = await render(
      React.createElement(Section, {
        label: 'Notifications',
        grouped: true,
        children: [
          React.createElement(Row, { key: 'a', label: 'One' }),
          React.createElement(Row, { key: 'b', label: 'Two' }),
          React.createElement(Row, { key: 'c', label: 'Three' }),
        ],
      }),
    );
    expect(root.findAllByType(Divider)).toHaveLength(2);
    const label = root.findAll((node) => node.type === 'Text' && node.props.children === 'Notifications')[0]!;
    expect(label.props.accessibilityRole).toBe('header');
  });

  it('a pressable tile is one button with its label', async () => {
    const onPress = jest.fn();
    const root = await render(React.createElement(GlassSurface, { onPress, accessibilityLabel: 'Counter', children: null }));
    tap(root, 'Counter');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a pushed screen has a back button; a place does not', async () => {
    const onBack = jest.fn();
    const root = await render(React.createElement(ScreenHeader, { title: 'Settings', back: { label: 'Back', onPress: onBack } }));
    tap(root, 'Back');
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => tree!.update(React.createElement(ScreenHeader, { title: 'Journal' })));
    expect(root.findAll((node) => node.props.accessibilityLabel === 'Back')).toEqual([]);
  });
});

describe('progress', () => {
  it('a progress line says how far, held to 0–100', async () => {
    const root = await render(
      React.createElement(React.Fragment, null, [
        React.createElement(ProgressLine, { key: 'a', value: 0.625, light: 'amber', accessibilityLabel: 'Water' }),
        React.createElement(ProgressLine, { key: 'b', value: 3, light: 'teal', accessibilityLabel: 'Over' }),
        React.createElement(ProgressLine, { key: 'c', value: Number.NaN, light: 'teal', accessibilityLabel: 'Nonsense' }),
      ]),
    );
    expect(control(root, 'Water').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 63 });
    expect(control(root, 'Over').props.accessibilityValue).toMatchObject({ now: 100 });
    expect(control(root, 'Nonsense').props.accessibilityValue).toMatchObject({ now: 0 });
  });

  it('week dashes draw kept, missed, not counted and today each their own way', async () => {
    const root = await render(
      React.createElement(WeekDashes, {
        days: ['done', 'missed', 'notCounted', 'done', 'done', 'missed', 'today'],
        light: 'teal',
        accessibilityLabel: '3 of the last 6 days',
      }),
    );
    const colour = (id: string) =>
      flat(root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0]!.props.style).backgroundColor;
    expect(colour('dash-done')).toBe(nightColors.cream);
    expect(colour('dash-missed')).toBe(nightColors.missed);
    expect(colour('dash-notCounted')).toBe(nightColors.notCounted);
    expect(colour('dash-today')).toBe(nightColors.teal);
    expect(control(root, '3 of the last 6 days').props.accessibilityRole).toBe('image');
  });
});

describe('under reduced motion', () => {
  it('a toggle snaps to its new place instead of sliding', async () => {
    const reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const props = { onValueChange: jest.fn(), accessibilityLabel: 'Reminders' };
    await render(React.createElement(Toggle, { ...props, value: false }));
    await act(async () => undefined);
    timing.mockClear();
    act(() => tree!.update(React.createElement(Toggle, { ...props, value: true })));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 0 }));
    timing.mockRestore();
    reduce.mockRestore();
  });
});
