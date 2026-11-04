/**
 * Dictating a todo's note.
 *
 * The editor is a sheet, which is the interesting part: a take is open on a
 * surface the user can dismiss out from under it. The rules pinned here are
 * that the mic only exists where dictation does, that it sits on the note —
 * the one long field — and that nothing can close or save the sheet while a
 * take is still running.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Button, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FilledField from '../src/components/sheet/FilledField';
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

const METRICS = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 24 },
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));

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
        SafeAreaProvider,
        { initialMetrics: METRICS },
        React.createElement(
          PaperProvider,
          null,
          React.createElement(TodoEditorSheet, {
            visible: true,
            today: '2026-11-04',
            todo: null,
            onDismiss,
            onSave,
          }),
        ),
      ),
    );
  });
  mounted.push(tree);
  const inputs = tree.root.findAllByType(FilledField);
  return {
    tree,
    onDismiss,
    onSave,
    /** Title and note; the typed deadline only appears behind "Other day". */
    inputs,
    note: inputs[1],
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
  it('puts the mic on the note, not on the title', () => {
    const { inputs, note } = render();
    expect(inputs).toHaveLength(2);
    expect((note.props.rightAccessory as Adornment)?.props.icon).toBe('microphone-outline');
    expect(inputs[0].props.rightAccessory).toBeUndefined();
  });

  it('dictates into the note in paragraphs', () => {
    render();
    expect(mockOptions.current?.join ?? 'paragraph').toBe('paragraph');
  });

  it('leaves the note bare where dictation does not exist', () => {
    mockField.supported = false;
    expect(render().note.props.rightAccessory).toBeUndefined();
  });

  /** The sheet's own Pressable — the first match, before its host view. */
  const scrim = (tree: ReactTestRenderer) =>
    tree.root.findAll((node) => node.props.testID === 'editor-sheet-scrim' && 'onPress' in node.props)[0]!;

  it('will not let the sheet be dismissed out from under an open take', () => {
    Object.assign(mockField, { sessionOpen: true, busy: true });
    const { tree, onDismiss } = render();
    expect(scrim(tree).props.onPress).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses normally when no take is running', () => {
    const { tree, onDismiss } = render();
    act(() => {
      (scrim(tree).props.onPress as () => void)();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('holds Save until the take is committed', () => {
    Object.assign(mockField, { sessionOpen: true, busy: true });
    const { tree } = render();
    const actions = tree.root.findAllByType(Button);
    expect(actions.every((button) => Boolean(button.props.disabled))).toBe(true);
  });
});
