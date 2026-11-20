/**
 * The shared surfaces, rendered: the peek sheet shell, the undo bar and the
 * empty state. Each is drawn once and used everywhere, so a regression here
 * shows on every screen at once.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HeaderPeekSheet from '../src/components/HeaderPeekSheet';
import EmptyState from '../src/components/EmptyState';
import { getThemeDecorations } from '../src/theme/decorations';

const METRICS = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        { initialMetrics: METRICS },
        React.createElement(PaperProvider, null, element),
      ),
    );
  });
  return tree;
}

const deco = getThemeDecorations('light');

const byTestId = (tree: ReactTestRenderer, id: string): ReactTestInstance[] =>
  tree.root.findAll((node) => node.props.testID === id);

/** The node drawn with this test id — not the component that passes the id down. */
const styledByTestId = (tree: ReactTestRenderer, id: string): ReactTestInstance =>
  byTestId(tree, id).filter((node) => node.props.style !== undefined)[0];

const styleOf = (node: ReactTestInstance): ViewStyle =>
  StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

const hasText = (tree: ReactTestRenderer, text: string): boolean =>
  tree.root.findAll((node) => node.props.children === text).length > 0;

describe('peek sheet shell', () => {
  it('has a grabber, the sheet radius and the sheet shadow', () => {
    const tree = render(
      React.createElement(
        HeaderPeekSheet,
        { visible: true, onDismiss: () => {}, title: 'Calendar', children: null },
      ),
    );
    expect(styleOf(styledByTestId(tree, 'peek-sheet-grabber'))).toMatchObject({ width: 36, height: 4 });

    const sheet = styleOf(styledByTestId(tree, 'peek-sheet'));
    expect(sheet.borderTopLeftRadius).toBe(deco.radius.xl);
    expect(sheet.shadowRadius).toBe(deco.sheetShadow.shadowRadius);
    expect(styleOf(styledByTestId(tree, 'peek-sheet-body')).paddingHorizontal).toBe(24);
    act(() => tree.unmount());
  });
});

describe('empty state', () => {
  it('says one thing, with no button unless there is something to do', () => {
    const tree = render(React.createElement(EmptyState, { message: 'Nothing yet.' }));
    expect(hasText(tree, 'Nothing yet.')).toBe(true);
    expect(byTestId(tree, 'empty-state-action')).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('offers its one action and runs it', () => {
    const onAction = jest.fn();
    const tree = render(
      React.createElement(EmptyState, {
        message: 'No habits yet.',
        actionLabel: 'Add a habit',
        onAction,
      }),
    );
    const action = byTestId(tree, 'empty-state-action')[0];
    act(() => (action.props.onPress as () => void)());
    expect(onAction).toHaveBeenCalledTimes(1);
    const tile = styleOf(byTestId(tree, 'empty-state')[0]);
    expect(tile.borderRadius).toBe(deco.radius.lg);
    act(() => tree.unmount());
  });
});

describe('undo bar', () => {
  it('floats as a rounded inverse bar, clear of the screen edges', () => {
    // Imported here so the module's Portal sits under the provider above.
    const { UndoSnackbar } = jest.requireActual<typeof import('../src/components/UndoSnackbar')>(
      '../src/components/UndoSnackbar',
    );
    const tree = render(
      React.createElement(UndoSnackbar, {
        message: 'Water +1',
        onUndo: () => {},
        onDismiss: () => {},
      }),
    );
    const bar = styleOf(byTestId(tree, 'undo-bar')[0]);
    expect(bar.borderRadius).toBe(16);
    expect(bar.shadowRadius).toBe(deco.sheetShadow.shadowRadius);
    expect(hasText(tree, 'Water +1')).toBe(true);
    act(() => tree.unmount());
  });
});
