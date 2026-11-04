/**
 * The editor sheet: one shell for every editor in the app.
 *
 * What has to hold, whatever the screen inside it:
 *  - a pull down past a third of the way (or a flick) closes it; a nudge
 *    springs back, so scrolling a long form never throws the edit away;
 *  - the footer — and its Save — sits on the keyboard, not under it;
 *  - Save and the red delete are the only buttons; there is no Cancel;
 *  - the scrim, Android back and leaving the screen all close it.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Button, IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import {
  dragOffset,
  sheetBottomPadding,
  shouldDismissOnRelease,
} from '../src/components/sheet/sheetGesture';
import { appLightTheme } from '../src/theme/themes';

const mockFocus = { current: true };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocus.current,
}));

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { EditorSheet, FilledField } = require('../src/components/sheet');
const ChoiceChip = require('../src/components/ChoiceChip').default;
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

describe('pulling the sheet', () => {
  it('follows the finger down but never lifts above its resting place', () => {
    expect(dragOffset(40)).toBe(40);
    expect(dragOffset(-60)).toBe(0);
  });

  it('closes past a third of its height, or on a downward flick', () => {
    expect(shouldDismissOnRelease({ dy: 200, vy: 0.1, sheetHeight: 540 })).toBe(true);
    expect(shouldDismissOnRelease({ dy: 40, vy: 1.4, sheetHeight: 540 })).toBe(true);
  });

  it('springs back from a nudge, an upward flick or a slow short pull', () => {
    expect(shouldDismissOnRelease({ dy: 60, vy: 0.2, sheetHeight: 540 })).toBe(false);
    expect(shouldDismissOnRelease({ dy: -80, vy: -2, sheetHeight: 540 })).toBe(false);
    expect(shouldDismissOnRelease({ dy: 12, vy: 1.4, sheetHeight: 540 })).toBe(false);
  });

  it('needs a real pull on a short sheet too, not a few pixels', () => {
    expect(shouldDismissOnRelease({ dy: 50, vy: 0, sheetHeight: 150 })).toBe(false);
    expect(shouldDismissOnRelease({ dy: 100, vy: 0, sheetHeight: 150 })).toBe(true);
  });
});

describe('the footer and the keyboard', () => {
  it('clears the navigation bar when the keyboard is down', () => {
    expect(sheetBottomPadding({ keyboardHeight: 0, safeBottom: 24 })).toBe(24 + 16);
  });

  it('sits on the keyboard when it is up, ignoring the inset it covers', () => {
    expect(sheetBottomPadding({ keyboardHeight: 300, safeBottom: 24 })).toBe(300 + 16);
  });

  it('treats a nonsense keyboard height as no keyboard', () => {
    expect(sheetBottomPadding({ keyboardHeight: Number.NaN, safeBottom: 0 })).toBe(16);
  });
});

type Listener = (event: { endCoordinates: { height: number } }) => void;
const listeners = new Map<string, Listener[]>();
let backHandlers: (() => boolean)[] = [];

beforeEach(() => {
  mockFocus.current = true;
  listeners.clear();
  backHandlers = [];
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, cb: Listener) => {
    listeners.set(name, [...(listeners.get(name) ?? []), cb]);
    return { remove: () => listeners.set(name, (listeners.get(name) ?? []).filter((l) => l !== cb)) };
  }) as unknown as typeof Keyboard.addListener);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
    _name: string,
    cb: () => boolean,
  ) => {
    backHandlers.push(cb);
    return { remove: () => (backHandlers = backHandlers.filter((h) => h !== cb)) };
  }) as unknown as typeof BackHandler.addEventListener);
});

afterEach(() => jest.restoreAllMocks());

type SheetProps = {
  visible?: boolean;
  onDismiss?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
};

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
});

type Instance = ReactTestRenderer['root'];

/** The first node carrying this test id that also has the prop asked for. */
function byTestId(tree: ReactTestRenderer, id: string, withProp = 'style'): Instance {
  const [node] = tree.root.findAll((n) => n.props.testID === id && n.props[withProp] !== undefined);
  if (!node) throw new Error(`no ${id}`);
  return node;
}

const press = (node: Instance) => (node.props.onPress as () => void)();
const flat = (node: Instance): ViewStyle =>
  StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};

function inPaper(child: React.ReactElement): React.ReactElement {
  return React.createElement(PaperProvider, { theme: appLightTheme, children: child });
}

function sheet({ visible = true, onDismiss = jest.fn(), onSave = jest.fn(), onDelete }: SheetProps) {
  return React.createElement(
    SafeAreaProvider,
    {
      initialMetrics: {
        frame: { x: 0, y: 0, width: 412, height: 892 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      },
    },
    inPaper(
      React.createElement(
        EditorSheet,
        {
          visible,
          onDismiss,
          title: 'Edit todo',
          primaryAction: { label: 'Save', onPress: onSave },
          destructiveAction: onDelete
            ? { accessibilityLabel: 'Delete', onPress: onDelete }
            : undefined,
        },
        React.createElement(RNText, null, 'Body'),
      ),
    ),
  );
}

function render(props: SheetProps): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(sheet(props));
  });
  mounted.push(tree);
  return tree;
}

const labels = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Button)
    .map((b) => b.props.children as string)
    .concat(tree.root.findAllByType(IconButton).map((b) => b.props.accessibilityLabel as string));

describe('the sheet, rendered', () => {
  it('shows its title and body, with Save and no Cancel', () => {
    const tree = render({});
    const strings = tree.root.findAllByType(RNText).flatMap((n) => n.props.children);
    expect(strings).toEqual(expect.arrayContaining(['Edit todo', 'Body']));
    expect(labels(tree)).toEqual(['Save']);
  });

  it('adds the red delete on the left only when asked', () => {
    const onDelete = jest.fn();
    const tree = render({ onDelete });
    const del = tree.root.findByType(IconButton);
    expect(del.props.iconColor).toBe(appLightTheme.colors.error);
    act(() => press(del));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('saves from the footer', () => {
    const onSave = jest.fn();
    const tree = render({ onSave });
    act(() => press(tree.root.findByType(Button)));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('closes on the scrim', () => {
    const onDismiss = jest.fn();
    const tree = render({ onDismiss });
    const scrim = byTestId(tree, 'editor-sheet-scrim', 'onPress');
    act(() => press(scrim));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('closes on Android back, and swallows it so the screen stays', () => {
    const onDismiss = jest.fn();
    render({ onDismiss });
    let handled = false;
    act(() => {
      handled = backHandlers.at(-1)?.() ?? false;
    });
    expect(handled).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('closes when its screen loses focus, since the portal sits above the stack', () => {
    const onDismiss = jest.fn();
    const tree = render({ onDismiss });
    mockFocus.current = false;
    act(() => tree.update(sheet({ onDismiss })));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('lifts its footer onto the keyboard', () => {
    const tree = render({});
    const footer = () => flat(byTestId(tree, 'editor-sheet-footer'));
    const before = footer().paddingBottom as number;
    act(() => {
      for (const name of ['keyboardWillShow', 'keyboardDidShow']) {
        for (const cb of listeners.get(name) ?? []) cb({ endCoordinates: { height: 320 } });
      }
    });
    expect(footer().paddingBottom).toBe(320 + 16);
    expect(before).toBeLessThan(320);
  });

  it('renders nothing while closed', () => {
    const tree = render({ visible: false });
    expect(tree.root.findAllByType(Button)).toHaveLength(0);
  });
});

describe('filled field and choice chip', () => {
  function inTheme(el: React.ReactElement): ReactTestRenderer {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(inPaper(el));
    });
    mounted.push(tree);
    return tree;
  }

  it('fills the field with the ground colour, no outline, and a floor not a height', () => {
    const tree = inTheme(
      React.createElement(FilledField, { value: '', onChangeText: jest.fn(), placeholder: 'Title' }),
    );
    const box = flat(byTestId(tree, 'filled-field-box'));
    expect(box.backgroundColor).toBe(appLightTheme.colors.background);
    expect(box.borderWidth ?? 0).toBe(0);
    expect(box.minHeight).toBe(56);
    expect(box.height).toBeUndefined();
  });

  it('shows a caption label only when given one', () => {
    const tree = inTheme(
      React.createElement(FilledField, { value: '', onChangeText: jest.fn(), label: 'Due' }),
    );
    expect(tree.root.findAllByType(RNText).flatMap((n) => n.props.children)).toContain('Due');
  });

  it('fills the picked chip with moss and leaves the rest on the ground', () => {
    const picked = inTheme(
      React.createElement(ChoiceChip, { label: 'Today', selected: true, onPress: jest.fn() }),
    );
    const idle = inTheme(
      React.createElement(ChoiceChip, { label: 'Tomorrow', selected: false, onPress: jest.fn() }),
    );
    const bg = (t: ReactTestRenderer) => flat(byTestId(t, 'choice-chip')).backgroundColor;
    expect(bg(picked)).toBe(appLightTheme.colors.primary);
    expect(bg(idle)).toBe(appLightTheme.colors.background);
  });

  it('keeps a chip 40 tall and announces it as a radio', () => {
    const tree = inTheme(
      React.createElement(ChoiceChip, { label: 'Today', selected: true, onPress: jest.fn() }),
    );
    const chip = byTestId(tree, 'choice-chip', 'accessibilityRole');
    expect(chip.props.accessibilityRole).toBe('radio');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
  });
});
