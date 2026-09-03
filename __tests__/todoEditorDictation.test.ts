/**
 * Dictating a todo's note.
 *
 * The editor is a dialog, which is the interesting part: a take is open on a
 * surface the user can dismiss out from under it. The rules pinned here are
 * that the mic only exists where dictation does, that it sits on the note —
 * the one long field — and that nothing can close or save the dialog while a
 * take is still running.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Button, Dialog, PaperProvider, TextInput } from 'react-native-paper';
import '../src/i18n';

const mockField = {
  supported: true,
  listening: false,
  capturing: false,
  starting: false,
  finishing: false,
  sessionOpen: false,
  busy: false,
  live: null as { committed: string; tail: string } | null,
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
const TodoEditorSheet = require('../src/screens/todos/TodoEditorSheet').default;
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

type Adornment = { props: { icon?: string } } | undefined;

const mounted: ReactTestRenderer[] = [];

function render() {
  const onDismiss = jest.fn();
  const onSave = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        PaperProvider,
        null,
        React.createElement(TodoEditorSheet, {
          visible: true,
          todo: null,
          onDismiss,
          onSave,
        }),
      ),
    );
  });
  mounted.push(tree);
  const inputs = tree.root.findAllByType(TextInput);
  return {
    tree,
    onDismiss,
    onSave,
    /** Title, deadline, note — in the order the dialog lays them out. */
    inputs,
    note: inputs[2],
  };
}

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
  jest.clearAllMocks();
  Object.assign(mockField, {
    supported: true,
    sessionOpen: false,
    busy: false,
    live: null,
    micDisabled: false,
  });
});

describe('todo editor dictation', () => {
  it('puts the mic on the note, not on the title or the deadline', () => {
    const { inputs, note } = render();
    expect(inputs).toHaveLength(3);
    expect((note.props.right as Adornment)?.props.icon).toBe('microphone-outline');
    // The deadline keeps its own clear button; the title stays bare.
    expect(inputs[0].props.right).toBeUndefined();
  });

  it('dictates into the note in paragraphs', () => {
    render();
    expect(mockOptions.current?.join ?? 'paragraph').toBe('paragraph');
  });

  it('leaves the note bare where dictation does not exist', () => {
    mockField.supported = false;
    expect(render().note.props.right).toBeUndefined();
  });

  it('will not let the dialog be dismissed out from under an open take', () => {
    Object.assign(mockField, { sessionOpen: true, busy: true });
    const { tree, onDismiss } = render();
    act(() => {
      (tree.root.findByType(Dialog).props.onDismiss as () => void)();
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses normally when no take is running', () => {
    const { tree, onDismiss } = render();
    act(() => {
      (tree.root.findByType(Dialog).props.onDismiss as () => void)();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('holds Cancel and Save until the take is committed', () => {
    Object.assign(mockField, { sessionOpen: true, busy: true });
    const { tree } = render();
    const actions = tree.root.findAllByType(Button);
    expect(actions.every((button) => Boolean(button.props.disabled))).toBe(true);
  });
});
