/**
 * The More page, rendered.
 *
 * It is the last page of the Home pager, so there is no native header: the
 * title has to come from the page itself — and a page that silently loses its
 * heading still looks plausible in a screenshot, which is exactly the kind of
 * thing worth pinning down here.
 *
 * It is also the whole of settings now, not a menu that leads to one, so this
 * pins what it has to offer: the places you manage, then the settings groups,
 * including the evening check-in that had a stored preference and no row.
 *
 * The last thing this guards is mount cost. The page is built the moment a
 * drag begins beside it, so it must not open the database to draw itself:
 * what it shows is already in a store.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import MoreScreen from '../src/screens/settings/MoreScreen';
import { getDatabase } from '../src/db/client';
import SettingsGroup from '../src/components/settings/SettingsGroup';
import SettingsRow from '../src/components/settings/SettingsRow';
import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(async () => {
    throw new Error('The More page must not open the database on mount');
  }),
}));

type Node = { props?: Record<string, unknown>; children?: Node[] | null } | string | null;

function texts(node: Node | Node[], found: string[] = []): string[] {
  if (node == null) return found;
  if (typeof node === 'string') {
    found.push(node);
    return found;
  }
  const children = Array.isArray(node) ? node : (node.children ?? []);
  for (const child of children) texts(child, found);
  return found;
}

function renderMorePage(): ReactTestRenderer {
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
          React.createElement(NavigationContainer, null, React.createElement(MoreScreen)),
        ),
      ),
    );
  });
  return tree;
}

function morePageTexts(): string[] {
  const tree = renderMorePage();
  const found = texts(tree.toJSON() as Node | Node[]);
  act(() => {
    tree.unmount();
  });
  return found;
}

describe('the More page', () => {
  const initial = useSettingsStore.getState();

  beforeEach(() => {
    (getDatabase as jest.Mock).mockClear();
    useSettingsStore.setState(initial);
  });

  it('carries its own title, since there is no header above it', () => {
    expect(morePageTexts()).toContain('More');
  });

  it('offers the places you manage', () => {
    const found = morePageTexts();
    for (const row of ['Manage', 'Trackers', 'Finished todos', 'Food', 'Ingredients']) {
      expect(found).toContain(row);
    }
  });

  it('no longer lists the places the dock already reaches', () => {
    const found = morePageTexts();
    for (const row of ['Insights', 'Journal', 'Calendar', 'Settings']) {
      expect(found).not.toContain(row);
    }
  });

  it('is the settings page: look, general, reminders, your data', () => {
    const found = morePageTexts();
    for (const heading of ['Look', 'General', 'Reminders', 'Your data']) {
      expect(found).toContain(heading);
    }
    for (const row of ['Language', 'Weather on Today', 'Back up', 'Clear data']) {
      expect(found).toContain(row);
    }
  });

  it('shows the evening check-in and its time', () => {
    useSettingsStore.setState({ eveningCheckInEnabled: true, eveningCheckInTime: '21:15' });
    const found = morePageTexts();
    expect(found).toContain('Evening check-in');
    expect(found).toContain('Check-in time');
    expect(found).toContain('21:15');
  });

  it('hides the time while the check-in is off', () => {
    useSettingsStore.setState({ eveningCheckInEnabled: false });
    const tree = renderMorePage();
    const titles = tree.root.findAllByType(SettingsRow).map((row) => row.props.title);
    expect(titles).toContain('Evening check-in');
    expect(titles).not.toContain('Check-in time');
    act(() => {
      tree.unmount();
    });
  });

  it('mounts without opening the database', () => {
    morePageTexts();
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it('keeps a gap between its groups', () => {
    // The Home scroll view wraps its children in one box, so a gap set on its
    // content style never reaches the groups: they would sit flush.
    const tree = renderMorePage();
    const groups = tree.root.findAllByType(SettingsGroup);
    expect(groups).toHaveLength(5);
    const parent = groups[0].parent;
    for (const group of groups) expect(group.parent).toBe(parent);
    const style = StyleSheet.flatten(parent?.props.style as StyleProp<ViewStyle>) ?? {};
    expect(style.gap ?? 0).toBeGreaterThan(0);
    act(() => {
      tree.unmount();
    });
  });
});
