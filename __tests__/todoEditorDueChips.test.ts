/**
 * Picking a todo's deadline with one tap. Typing YYYY-MM-DD on a phone was the
 * slowest part of adding a todo; the chips cover the deadlines people actually
 * set, and "Other day" keeps the typed field for the rest.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Button, Chip, PaperProvider, TextInput } from 'react-native-paper';
import '../src/i18n';
import type { Todo } from '../src/protocol';

jest.mock('../src/dictation/useDictationField', () => ({
  useDictationField: () => ({
    supported: false,
    sessionOpen: false,
    busy: false,
    live: null,
    notice: null,
    error: null,
    status: null,
    micDisabled: true,
    start: jest.fn(),
    finish: jest.fn(),
    clearNotices: jest.fn(),
  }),
}));

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const TodoEditorSheet = require('../src/screens/todos/TodoEditorSheet').default;
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

const TODAY = '2026-11-04'; // a Wednesday
const mounted: ReactTestRenderer[] = [];

function render(todo: Partial<Todo> | null = null) {
  const onSave = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        PaperProvider,
        null,
        React.createElement(TodoEditorSheet, {
          visible: true,
          today: TODAY,
          todo: todo ? ({ id: 't1', title: 'Call the vet', note: null, dueDate: null, ...todo } as Todo) : null,
          onDismiss: jest.fn(),
          onSave,
        }),
      ),
    );
  });
  mounted.push(tree);
  const chip = (label: string) =>
    tree.root.findAllByType(Chip).find((c) => c.props.children === label)!;
  const save = async () => {
    const button = tree.root.findAllByType(Button).find((b) => b.props.children === 'Save')!;
    await act(async () => {
      await (button.props.onPress as () => Promise<void>)();
    });
  };
  const type = (index: number, text: string) =>
    act(() => {
      (tree.root.findAllByType(TextInput)[index]!.props.onChangeText as (t: string) => void)(text);
    });
  return { tree, onSave, chip, save, type };
}

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
});

describe('todo deadline chips', () => {
  it('saves tomorrow with one tap', async () => {
    const { chip, save, type, onSave } = render();
    type(0, 'Buy bread');
    act(() => (chip('Tomorrow').props.onPress as () => void)());
    await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueDate: '2026-11-05' }));
  });

  it('starts a new todo with no date and no date field', () => {
    const { tree, chip } = render();
    expect(chip('No date').props.selected).toBe(true);
    // Title and note only: the typed date waits behind "Other day".
    expect(tree.root.findAllByType(TextInput)).toHaveLength(2);
  });

  it('shows a saved deadline on the chip it matches', () => {
    expect(render({ dueDate: '2026-11-07' }).chip('Weekend').props.selected).toBe(true);
  });

  it('opens the typed field for a deadline no chip covers', () => {
    const { tree, chip } = render({ dueDate: '2026-12-25' });
    expect(chip('Other day').props.selected).toBe(true);
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(3);
    expect(inputs[1]!.props.value).toBe('2026-12-25');
  });

  it('clears a deadline with No date', async () => {
    const { chip, save, onSave } = render({ dueDate: '2026-11-05' });
    act(() => (chip('No date').props.onPress as () => void)());
    await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueDate: null }));
  });

  it('still refuses a typed date that does not exist', async () => {
    const { chip, save, type, onSave } = render({ dueDate: null });
    act(() => (chip('Other day').props.onPress as () => void)());
    type(1, '2026-02-31');
    await save();
    expect(onSave).not.toHaveBeenCalled();
  });
});
