/**
 * The one slot on the right of the quick-add field.
 *
 * A dense single-line input has room for exactly one trailing control, and
 * three things want it: the mic that starts a spoken todo, the tick that ends
 * the take, and the plus that files the todo. They are never all useful at
 * once, so the slot shows whichever one the field is actually waiting for —
 * and on a phone that cannot dictate, the mic is simply not there.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { ROW_TILE_SIZE } from '../src/kinds/TrackerIdentityMark';
import { trackerCardStyles } from '../src/kinds/trackerCardStyles';
import { TODO_TITLE_INSET } from '../src/screens/todos/TodoRow';
import { IconButton, Text } from 'react-native-paper';
import '../src/i18n';
import type { DictationLivePreview } from '../src/dictation/livePreview';

type FieldStub = {
  supported: boolean;
  listening: boolean;
  capturing: boolean;
  starting: boolean;
  finishing: boolean;
  sessionOpen: boolean;
  busy: boolean;
  live: DictationLivePreview | null;
  liveChars: number;
  notice: { text: string; tone: 'error' | 'notice' } | null;
  error: string | null;
  status: { message: string; progress: number | null } | null;
  micDisabled: boolean;
  start: jest.Mock;
  finish: jest.Mock;
  cancel: jest.Mock;
  clearNotices: jest.Mock;
  reset: jest.Mock;
};

const mockField: FieldStub = {
  supported: true,
  listening: false,
  capturing: false,
  starting: false,
  finishing: false,
  sessionOpen: false,
  busy: false,
  live: null,
  liveChars: 0,
  notice: null,
  error: null,
  status: null,
  micDisabled: false,
  start: jest.fn(),
  finish: jest.fn(),
  cancel: jest.fn(),
  clearNotices: jest.fn(),
  reset: jest.fn(),
};

const mockOptions = { current: null as Record<string, unknown> | null };

jest.mock('../src/dictation/useDictationField', () => ({
  useDictationField: (options: Record<string, unknown>) => {
    mockOptions.current = options;
    return mockField;
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const TodoQuickAdd = require('../src/screens/todos/TodoQuickAdd').default;
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

type Adornment = { props: Record<string, unknown> } | null | undefined;

const mounted: ReactTestRenderer[] = [];

function render(props: {
  value?: string;
  onSubmit?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const onChangeText = jest.fn();
  const onSubmit = props.onSubmit ?? jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(TodoQuickAdd, {
        value: props.value ?? '',
        onChangeText,
        onSubmit,
        onFocusChange: props.onFocusChange,
      }),
    );
  });
  mounted.push(tree);
  const input = tree.root.findByType(TextInput);
  // The line's one trailing control; the plus that leads it is a glyph, not a button.
  const trailing = tree.root.findAllByType(IconButton);
  return {
    tree,
    input,
    onChangeText,
    onSubmit,
    right: (trailing[0] ?? null) as Adornment,
  };
}

afterEach(() => {
  // Paper's Icon loads its font asynchronously; leaving trees mounted turns
  // that late setState into act() noise across the whole suite.
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockField, {
    supported: true,
    listening: false,
    capturing: false,
    starting: false,
    finishing: false,
    sessionOpen: false,
    busy: false,
    live: null,
    liveChars: 0,
    notice: null,
    error: null,
    status: null,
    micDisabled: false,
  });
});

describe('todo quick-add trailing control', () => {
  it('offers the mic while the field is empty', () => {
    const { right } = render({});
    expect(right?.props.icon).toBe('microphone-outline');
  });

  it('offers the plus once there is something to file', () => {
    const onSubmit = jest.fn();
    const { right } = render({ value: 'buy milk', onSubmit });
    expect(right?.props.icon).toBe('plus');
    act(() => {
      (right?.props.onPress as () => void)();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('becomes the way to end the take while the mic is open', () => {
    Object.assign(mockField, { sessionOpen: true, listening: true, busy: true });
    const { right } = render({});
    expect(right?.props.icon).toBe('check');
    act(() => {
      (right?.props.onPress as () => void)();
    });
    expect(mockField.finish).toHaveBeenCalledTimes(1);
  });

  it('shows no mic at all where dictation does not exist', () => {
    // iOS, web, and any Android phone without the engine: absent, not broken.
    mockField.supported = false;
    expect(render({}).right ?? undefined).toBeUndefined();
  });

  it('still files a typed todo where dictation does not exist', () => {
    mockField.supported = false;
    expect(render({ value: 'buy milk' }).right?.props.icon).toBe('plus');
  });

  it('lets the words appear in the field as they are heard', () => {
    Object.assign(mockField, {
      sessionOpen: true,
      listening: true,
      busy: true,
      live: { committed: 'call the', tail: 'dentist' },
    });
    const { input } = render({});
    expect(input.props.value).toBe('call the dentist');
    // Typing into a field the mic is writing into fights the caret.
    expect(input.props.editable).toBe(false);
  });

  it('leaves the engine asleep until the mic is actually asked for', () => {
    // The Today page is mounted for the whole app session. Waking the engine on
    // mount would load a 123M-parameter model into memory at every cold start.
    const { right } = render({});
    expect(mockOptions.current?.active).toBe(false);
    // Asleep is not the same as unavailable: the mic must still be pressable.
    expect(right?.props.disabled).toBe(false);
  });

  it('wakes the engine and opens the take in the one press', () => {
    mockField.micDisabled = true; // what the hook reports while inactive
    const { tree, right } = render({});
    act(() => {
      (right?.props.onPress as () => void)();
    });
    expect(mockOptions.current?.active).toBe(true);
    expect(mockOptions.current?.autoStart).toBe(true);
    expect(mockOptions.current?.autoStartToken).toBeTruthy();
    expect(tree).toBeTruthy();
  });

  it('dictates inline, against the title cap', () => {
    render({});
    expect(mockOptions.current?.join).toBe('inline');
    expect(mockOptions.current?.maxLength).toBe(120);
  });

  it('says what went wrong under the field', () => {
    mockField.error = 'Allow Microphone for Life';
    const { tree } = render({});
    const shown = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children);
    expect(shown).toContain('Allow Microphone for Life');
  });
});

/**
 * Filing todos in a row, and letting go of the keyboard cleanly.
 *
 * The field keeps the keyboard through a submit so several todos can be typed
 * one after another. What it must not do is keep focus once the keyboard has
 * gone: on Android, Back closes the keyboard and leaves the caret blinking, and
 * a focused field brings the keyboard back the next time anything on the page
 * is touched — ticking a todo's box reopened it.
 */
describe('todo quick-add keyboard', () => {
  type Listener = () => void;
  const listeners = new Map<string, Listener[]>();

  beforeEach(() => {
    listeners.clear();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, cb: Listener) => {
      listeners.set(name, [...(listeners.get(name) ?? []), cb]);
      return {
        remove: () => listeners.set(name, (listeners.get(name) ?? []).filter((l) => l !== cb)),
      };
    }) as unknown as typeof Keyboard.addListener);
  });

  afterEach(() => jest.restoreAllMocks());

  // The mocked TextInput shares one blur across instances; one field is mounted at a time.
  const blur = TextInput.prototype.blur as unknown as jest.Mock;

  it('files a typed todo and keeps the keyboard for the next one', () => {
    const { input, onSubmit } = render({ value: 'buy milk' });
    expect(input.props.submitBehavior).toBe('submit');
    act(() => {
      (input.props.onSubmitEditing as () => void)();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(blur).not.toHaveBeenCalled();
  });

  it('takes an empty submit as "done": nothing filed, keyboard away', () => {
    const { input, onSubmit } = render({ value: '   ' });
    act(() => {
      (input.props.onSubmitEditing as () => void)();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(blur).toHaveBeenCalledTimes(1);
  });

  it('does not take the second half of a hardware Enter for "done"', () => {
    // Android reports the key on the way down and on the way up; by the second
    // report the first has already emptied the field.
    const { tree, input, onSubmit } = render({ value: 'buy milk' });
    act(() => {
      (input.props.onSubmitEditing as () => void)();
    });
    act(() => {
      tree.update(
        React.createElement(TodoQuickAdd, { value: '', onChangeText: jest.fn(), onSubmit }),
      );
    });
    act(() => {
      (tree.root.findByType(TextInput).props.onSubmitEditing as () => void)();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(blur).not.toHaveBeenCalled();
  });

  it('gives up focus when the keyboard is closed from outside, as Back does', () => {
    const { input } = render({});
    act(() => {
      (input.props.onFocus as () => void)();
    });
    act(() => {
      listeners.get('keyboardDidHide')?.forEach((listener) => listener());
    });
    expect(blur).toHaveBeenCalledTimes(1);
  });

  it('does not listen for the keyboard while it has no focus', () => {
    const { input } = render({});
    expect(listeners.get('keyboardDidHide') ?? []).toHaveLength(0);
    act(() => {
      (input.props.onFocus as () => void)();
    });
    act(() => {
      (input.props.onBlur as () => void)();
    });
    expect(listeners.get('keyboardDidHide') ?? []).toHaveLength(0);
  });

  it('tells the page when it takes and loses focus', () => {
    const onFocusChange = jest.fn();
    const { input } = render({ onFocusChange });
    act(() => {
      (input.props.onFocus as () => void)();
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    act(() => {
      (input.props.onBlur as () => void)();
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
});

/**
 * The line is written under the todo rows, so it keeps their columns: its plus
 * stands where their tiles do and its words start where theirs do.
 */
describe('todo quick-add columns', () => {
  const flat = (style: unknown) => StyleSheet.flatten(style as ViewStyle);

  it('puts the plus in the tile column and the words in the title column', () => {
    const { tree } = render({});
    const views = tree.root.findAllByType(View);
    const row = views.find((view) => flat(view.props.style)?.flexDirection === 'row');
    const mark = views.find((view) => view.props.importantForAccessibility === 'no');
    const rowStyle = flat(row?.props.style);
    const markStyle = flat(mark?.props.style);
    const card = flat(trackerCardStyles.oneLineRow);

    expect(rowStyle.paddingLeft).toBe(card.paddingLeft);
    expect(markStyle.width).toBe(ROW_TILE_SIZE);

    const field = views.find((view) => flat(view.props.style)?.flex === 1 && view !== row);
    const wordsStart =
      Number(rowStyle.paddingLeft) +
      Number(markStyle.width) +
      Number(rowStyle.gap) +
      Number(flat(field?.props.style).marginLeft);
    expect(wordsStart).toBe(TODO_TITLE_INSET);
  });

  it('measures the title column the way a todo row builds it', () => {
    const card = flat(trackerCardStyles.oneLineRow);
    // Row padding, the tile, the row gap, and the 4pt the words stand off it.
    expect(TODO_TITLE_INSET).toBe(Number(card.paddingLeft) + ROW_TILE_SIZE + Number(card.gap) + 4);
  });
});
