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
import { Text, TextInput } from 'react-native-paper';
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

function render(props: { value?: string; onSubmit?: () => void }) {
  const onChangeText = jest.fn();
  const onSubmit = props.onSubmit ?? jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(TodoQuickAdd, {
        value: props.value ?? '',
        onChangeText,
        onSubmit,
      }),
    );
  });
  mounted.push(tree);
  const input = tree.root.findByType(TextInput);
  return {
    tree,
    input,
    onChangeText,
    onSubmit,
    right: input.props.right as Adornment,
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
    // Pressing it must not also focus the field: the take is about to dismiss
    // the keyboard, and raising it first makes the sheet jump.
    expect(right?.props.forceTextInputFocus).toBe(false);
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
    expect(render({}).right).toBeUndefined();
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
    // The Todos tab is mounted for the whole app session. Waking the engine on
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
    mockField.error = 'Allow Microphone for Life Dashboard';
    const { tree } = render({});
    const shown = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children);
    expect(shown).toContain('Allow Microphone for Life Dashboard');
  });
});
