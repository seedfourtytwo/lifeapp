/**
 * The More page, rendered.
 *
 * It used to be a pushed stack screen and got its title from the native
 * header. As the fifth page of the Home pager there is no header, so the title
 * has to come from the page itself — and a menu that silently loses its
 * heading still looks plausible in a screenshot, which is exactly the kind of
 * thing worth pinning down here.
 *
 * The second thing this guards is mount cost. All five Home pages mount at
 * startup, so this one has to stay a fixed list of rows: no store to hydrate,
 * no query to wait on. The destinations behind the rows load their own data
 * when they are pushed.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import SettingsMenuScreen from '../src/screens/settings/SettingsMenuScreen';
import { getDatabase } from '../src/db/client';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(async () => {
    throw new Error('The More page must not open the database on mount');
  }),
}));

type Node = { props?: Record<string, unknown>; children?: Node[] | null } | string | null;

function texts(node: Node, found: string[] = []): string[] {
  if (node == null) return found;
  if (typeof node === 'string') {
    found.push(node);
    return found;
  }
  for (const child of node.children ?? []) texts(child, found);
  return found;
}

function renderMorePage(): string[] {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 400, height: 800 },
            insets: { top: 24, left: 0, right: 0, bottom: 48 },
          },
        },
        React.createElement(
          PaperProvider,
          null,
          React.createElement(
            NavigationContainer,
            null,
            React.createElement(SettingsMenuScreen),
          ),
        ),
      ),
    );
  });
  const found = texts(tree.toJSON() as Node);
  act(() => {
    tree.unmount();
  });
  return found;
}

describe('the More page', () => {
  beforeEach(() => {
    (getDatabase as jest.Mock).mockClear();
  });

  it('carries its own title now that there is no header above it', () => {
    expect(renderMorePage()).toContain('More');
  });

  it('still offers every destination the pushed screen did', () => {
    const found = renderMorePage();
    for (const row of [
      'Insights',
      'Journal',
      'Calendar',
      'Trackers',
      'Ingredients',
      'Settings',
    ]) {
      expect(found).toContain(row);
    }
  });

  it('mounts without opening the database', () => {
    renderMorePage();
    expect(getDatabase).not.toHaveBeenCalled();
  });
});
