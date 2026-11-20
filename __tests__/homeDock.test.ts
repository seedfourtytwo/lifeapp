/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * The Home dock, rendered: three words and nothing else. Each is a tab with a
 * thumb-sized floor, and the current one is told apart by more than colour —
 * its weight and the dash under it.
 */
import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(effect, [effect]);
  },
  useNavigation: () => ({ navigate: () => {} }),
  useIsFocused: () => true,
}));
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(async () => {
    throw new Error('no database in this test');
  }),
}));
jest.mock('../src/screens/TodayScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/JournalScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/settings/MoreScreen', () => ({ __esModule: true, default: () => null }));

import '../src/i18n';
import HomeScreen from '../src/screens/HomeScreen';

function flat<T>(style: unknown): T {
  return (StyleSheet.flatten(style as StyleProp<T>) ?? {}) as T;
}

/** The pressable host view of each dock word, in order. */
function dockTabs(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'tab',
  );
}

function wordOf(tab: ReactTestInstance): ReactTestInstance {
  return tab.find((node) => typeof node.type === 'string' && node.type === 'Text');
}

function dashOf(tab: ReactTestInstance): ViewStyle {
  const dashes = tab.findAll(
    (node) =>
      typeof node.type === 'string' && node.type === 'View' && node.props.accessibilityRole == null,
  );
  // Counted rather than matched: a failed match would print the whole tree.
  expect(dashes.length).toBe(1);
  return flat<ViewStyle>(dashes[0].props.style);
}

describe('the Home dock', () => {
  function render() {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(
          SafeAreaProvider,
          {
            initialMetrics: {
              frame: { x: 0, y: 0, width: 400, height: 900 },
              insets: { top: 24, left: 0, right: 0, bottom: 48 },
            },
          },
          React.createElement(PaperProvider, null, React.createElement(HomeScreen)),
        ),
      );
    });
    return tree;
  }

  it('is three words: Today, Journal, More', () => {
    const tree = render();
    const tabs = dockTabs(tree.root);

    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Today', 'Journal', 'More']);
    // A word and its dash: no icon beside either.
    for (const tab of tabs) expect(tab.findAllByType('Text' as never).length).toBe(1);
    act(() => tree.unmount());
  });

  it('gives each word a floor a thumb can find, and no fixed height', () => {
    const tree = render();
    for (const tab of dockTabs(tree.root)) {
      const style = flat<ViewStyle>(tab.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeUndefined();
    }
    act(() => tree.unmount());
  });

  it('marks the current page by weight and a dash, not by colour alone', () => {
    const tree = render();
    const [today, journal] = dockTabs(tree.root);

    expect(today.props.accessibilityState).toEqual({ selected: true });
    expect(journal.props.accessibilityState).toEqual({ selected: false });
    expect(flat<TextStyle>(wordOf(today).props.style).fontWeight).toBe('500');
    expect(flat<TextStyle>(wordOf(journal).props.style).fontWeight).toBe('400');
    expect(dashOf(today).backgroundColor).toBeDefined();
    expect(dashOf(journal).backgroundColor).toBeUndefined();
    // The dash keeps its place either way, so choosing a page moves no word.
    expect(dashOf(journal).height).toBe(dashOf(today).height);
    act(() => tree.unmount());
  });

  it('caps how far a word follows the system font, since three share one row', () => {
    const tree = render();
    for (const tab of dockTabs(tree.root)) {
      expect(wordOf(tab).props.maxFontSizeMultiplier).toBe(1.3);
      expect(wordOf(tab).props.numberOfLines).toBe(1);
    }
    act(() => tree.unmount());
  });
});
