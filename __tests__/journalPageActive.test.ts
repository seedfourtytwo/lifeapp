/**
 * When the Journal page loads.
 *
 * It is a page of the Home pager now, and a pager swipe raises no navigation
 * focus event — the thing its reload used to hang on. So the page is told when
 * it is the one on screen, and that is what it loads on: not when it is built
 * (a drag beside it builds it, and it reads the database), and again every
 * time the user comes back to it.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import JournalScreen from '../src/screens/JournalScreen';
import { getDatabase } from '../src/db/client';

// The stack is not under test: Home stays the focused screen throughout.
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

function page(active: boolean) {
  return React.createElement(
    SafeAreaProvider,
    {
      initialMetrics: {
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 24, left: 0, right: 0, bottom: 48 },
      },
    },
    React.createElement(PaperProvider, null, React.createElement(JournalScreen, { active })),
  );
}

describe('the Journal page', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    (getDatabase as jest.Mock).mockClear();
    // The notebook store reports the database this test withholds.
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('reads nothing while it is built but off screen', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(page(false));
    });
    expect(getDatabase).not.toHaveBeenCalled();
    act(() => {
      tree.unmount();
    });
  });

  it('loads when it becomes the page on screen, and again on each return', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(page(false));
    });

    await act(async () => {
      tree.update(page(true));
    });
    const afterFirstVisit = (getDatabase as jest.Mock).mock.calls.length;
    expect(afterFirstVisit).toBeGreaterThan(0);

    await act(async () => {
      tree.update(page(false));
    });
    expect((getDatabase as jest.Mock).mock.calls.length).toBe(afterFirstVisit);

    await act(async () => {
      tree.update(page(true));
    });
    expect((getDatabase as jest.Mock).mock.calls.length).toBeGreaterThan(afterFirstVisit);

    act(() => {
      tree.unmount();
    });
  });
});
