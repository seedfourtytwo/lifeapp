/**
 * The note sheet, rendered.
 *
 * It is a Paper modal in a portal, which sits above the navigation stack: a
 * screen pushed over it does not cover it, so it closes itself when its own
 * screen loses focus. Android draws edge to edge, so the window no longer
 * shrinks for the keyboard — the sheet lifts itself by the keyboard's height.
 * A quick dictation (opened by a mic glyph) is filed by Done, without a second
 * tap on Save.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard, StyleSheet } from 'react-native';
import { IconButton, Modal, PaperProvider, TouchableRipple } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { dialogKeyboardLift } from '../src/hooks/keyboardInset';

const mockFocus = { current: true };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocus.current,
}));

const mockField = {
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
const mockOptions = { current: null as null | { onChangeText: (t: string) => void; onFinished?: () => void } };
jest.mock('../src/dictation/useDictationField', () => ({
  useDictationField: (options: { onChangeText: (t: string) => void; onFinished?: () => void }) => {
    mockOptions.current = options;
    return mockField;
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const NoteEditorSheet = require('../src/notes/NoteEditorSheet').default;
const NoteEditorChapterBar = require('../src/notes/NoteEditorChapterBar').default;
const { NoteEditorActions } = require('../src/notes/NoteEditorActions');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

type Listener = (event: { endCoordinates: { height: number } }) => void;
const listeners = new Map<string, Listener[]>();
let addListener: jest.SpyInstance;

const mounted: ReactTestRenderer[] = [];

function wrap(child: React.ReactElement) {
  return React.createElement(
    SafeAreaProvider,
    {
      initialMetrics: {
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 24, left: 0, right: 0, bottom: 48 },
      },
    },
    React.createElement(PaperProvider, null, child),
  );
}

function renderSheet(props: Record<string, unknown> = {}) {
  const onDismiss = jest.fn();
  const onSave = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      wrap(
        React.createElement(NoteEditorSheet, {
          visible: true,
          date: '2026-11-04',
          trackerName: 'Meditate',
          initialBody: '',
          sessionKey: 'tracker:1:2026-11-04',
          onDismiss,
          onSave,
          ...props,
        }),
      ),
    );
  });
  mounted.push(tree);
  return { tree, onDismiss, onSave };
}

beforeEach(() => {
  listeners.clear();
  addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: Listener) => {
    listeners.set(name, [...(listeners.get(name) ?? []), fn]);
    return { remove: () => listeners.set(name, (listeners.get(name) ?? []).filter((l) => l !== fn)) };
  }) as never);
});

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
  addListener.mockRestore();
  mockFocus.current = true;
  jest.clearAllMocks();
});

function emit(names: string[], height: number) {
  act(() => {
    for (const name of names) for (const fn of listeners.get(name) ?? []) fn({ endCoordinates: { height } });
  });
}

function modalPaddingBottom(tree: ReactTestRenderer): number {
  const style = StyleSheet.flatten(tree.root.findByType(Modal).props.style) as { paddingBottom?: number };
  return style.paddingBottom ?? 0;
}

describe('note sheet and the keyboard', () => {
  it('lifts itself clear of the keyboard, and settles back when it hides', () => {
    const { tree } = renderSheet();
    expect(modalPaddingBottom(tree)).toBe(0);
    emit(['keyboardWillShow', 'keyboardDidShow'], 300);
    expect(modalPaddingBottom(tree)).toBe(dialogKeyboardLift(300));
    emit(['keyboardWillHide', 'keyboardDidHide'], 0);
    expect(modalPaddingBottom(tree)).toBe(0);
  });
});

describe('note sheet and navigation', () => {
  it('closes when its screen loses focus', () => {
    const { tree, onDismiss } = renderSheet();
    expect(onDismiss).not.toHaveBeenCalled();
    mockFocus.current = false;
    act(() => {
      tree.update(
        wrap(
          React.createElement(NoteEditorSheet, {
            visible: true,
            date: '2026-11-04',
            trackerName: 'Meditate',
            initialBody: '',
            sessionKey: 'tracker:1:2026-11-04',
            onDismiss,
            onSave: jest.fn(),
          }),
        ),
      );
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does nothing when closed and out of focus', () => {
    mockFocus.current = false;
    const { onDismiss } = renderSheet({ visible: false });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Done on a quick dictation', () => {
  function sayAndPressDone(tree: ReactTestRenderer, words: string) {
    act(() => {
      mockOptions.current?.onChangeText(words);
    });
    act(() => {
      (tree.root.findByType(NoteEditorActions).props.onDone as () => void)();
    });
    act(() => {
      mockOptions.current?.onFinished?.();
    });
  }

  it('files the note without a second tap on Save', () => {
    const { tree, onSave } = renderSheet({ autoStartDictation: true });
    sayAndPressDone(tree, 'Calm, ten minutes');
    expect(mockField.finish).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Calm, ten minutes');
  });

  it('keeps the sheet open when the take ended on its own', () => {
    const { onSave } = renderSheet({ autoStartDictation: true });
    act(() => {
      mockOptions.current?.onChangeText('cut off');
    });
    act(() => {
      mockOptions.current?.onFinished?.();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the sheet open in a note opened to write in', () => {
    const { tree, onSave } = renderSheet({ autoStartDictation: false });
    sayAndPressDone(tree, 'one more take to come');
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('chapter bar', () => {
  it('gives every control a 48dp target', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        wrap(
          React.createElement(NoteEditorChapterBar, {
            chapters: [
              { id: 'a', body: 'Morning walk' },
              { id: 'b', body: 'Evening' },
            ],
            activeId: 'a',
            index: 0,
            total: 2,
            isDraft: false,
            locked: false,
            onSelect: jest.fn(),
            onAdd: jest.fn(),
            onDelete: jest.fn(),
          }),
        ),
      );
    });
    mounted.push(tree);
    type Box = { width?: number; height?: number; minHeight?: number };
    const box = (style: unknown) => StyleSheet.flatten(style) as Box;
    const steps = tree.root.findAllByType(IconButton);
    expect(steps).toHaveLength(4);
    for (const step of steps) {
      expect(box(step.props.style).width).toBeGreaterThanOrEqual(48);
      expect(box(step.props.style).height).toBeGreaterThanOrEqual(48);
    }
    // The jump control is the one ripple that is not inside an icon button.
    const [jump] = tree.root
      .findAllByType(TouchableRipple)
      .filter((node) => !steps.some((step) => step.findAll((inner) => inner === node).length > 0));
    expect(box(jump.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});
