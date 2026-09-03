/**
 * How tall a Home page is.
 *
 * The five pages sit side by side inside a horizontal ScrollView, and a
 * ScrollView will not give its children a cross-axis size — so each page is
 * handed an explicit height, measured at runtime.
 *
 * Measuring the *wrong* node is what broke it: `onLayout` sat on the view that
 * carries the status-bar padding, and a view reports its own padding as part of
 * its height. Pages came out one status bar taller than the space they had
 * (845 against 779 on the phone), so the last inch of every tab sat under the
 * dock, unreachable — the list bounced instead of scrolling, because as far as
 * it knew its content already fitted.
 *
 * The rule: the page height comes from the pager itself, the view the pages
 * actually sit in.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '../src/screens/HomeScreen';

// Home only reaches navigation for focus, and focus is not what is under test.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(effect, [effect]);
  },
  useNavigation: () => ({ navigate: () => {} }),
}));

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(async () => {
    throw new Error('no database in this test');
  }),
}));

// The pages themselves are not what is under test, and each drags in its own
// stores; empty stand-ins keep this about the layout.
jest.mock('../src/screens/HabitsScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/CountersScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/NutritionScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/TodosScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/settings/SettingsMenuScreen', () => ({
  __esModule: true,
  default: () => null,
}));

const TOP_INSET = 66;
const PAGER_HEIGHT = 779;

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 400, height: 900 },
            insets: { top: TOP_INSET, left: 0, right: 0, bottom: 48 },
          },
        },
        React.createElement(PaperProvider, null, React.createElement(HomeScreen)),
      ),
    );
  });
  return tree;
}

/** The horizontal pager the five pages live in. */
function pagerOf(tree: ReactTestRenderer) {
  return tree.root.find(
    (node) => node.props.horizontal === true && node.props.pagingEnabled === true,
  );
}

function viewStyle(props: { style?: unknown }): ViewStyle {
  return StyleSheet.flatten(props.style as StyleProp<ViewStyle>) ?? {};
}

/** The explicit height on each page wrapper. */
function pageHeights(tree: ReactTestRenderer): (DimensionValue | undefined)[] {
  return tree.root
    .findAll(
      (node) =>
        typeof node.type !== 'string' &&
        node.props.importantForAccessibility != null &&
        node.props.pointerEvents != null,
    )
    .map((node) => viewStyle(node.props).height);
}

describe('the height a Home page is given', () => {
  it('is measured on the pager, not on the view that carries the top inset', () => {
    const tree = render();
    const pager = pagerOf(tree);
    const onLayout = pager.props.onLayout as ((event: unknown) => void) | undefined;
    expect(typeof onLayout).toBe('function');

    act(() => {
      onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: PAGER_HEIGHT } },
      });
    });

    const heights = pageHeights(tree);
    expect(heights).toHaveLength(5);
    for (const height of heights) expect(height).toBe(PAGER_HEIGHT);

    act(() => {
      tree.unmount();
    });
  });

  it('leaves the padded view out of the measurement entirely', () => {
    const tree = render();
    // A view that both reports its layout and pads itself is the old bug: what
    // it reports is its padding plus the space the pages actually get.
    const padded = tree.root.findAll(
      (node) =>
        typeof node.props.onLayout === 'function' &&
        ((viewStyle(node.props).paddingTop as number | undefined) ?? 0) > 0,
    );
    expect(padded).toHaveLength(0);

    act(() => {
      tree.unmount();
    });
  });
});
