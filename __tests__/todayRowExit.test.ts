/**
 * A row that leaves a list fades out in place instead of blinking away — and
 * it is drawn from its last render, because its owner may already have
 * forgotten it (a finished todo is gone from the open list at once).
 */
import React from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { DraggableTrackerList } from '../src/screens/shared/DraggableTrackerList';

const NAMES: Record<string, string> = { a: 'Alpha', b: 'Beta', c: 'Gamma' };

function list(ids: string[], known: string[] = ids) {
  return React.createElement(
    PaperProvider,
    null,
    React.createElement(DraggableTrackerList, {
      itemIds: ids,
      onReorder: () => {},
      // Like the page's renderers: nothing for an id it no longer knows.
      renderItem: (id: string) =>
        known.includes(id) ? React.createElement(Text, null, NAMES[id]) : null,
    }),
  );
}

function shownNames(tree: ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map((node) => String(node.props.children));
}

/** The test renderer lays nothing out, so report each row's height by hand. */
function layOut(tree: ReactTestRenderer): void {
  const rows = tree.root.findAll(
    (node) => typeof node.type !== 'string' && typeof node.props.onLayout === 'function',
  );
  act(() => {
    for (const row of rows) {
      const onLayout = row.props.onLayout as (event: LayoutChangeEvent) => void;
      onLayout({ nativeEvent: { layout: { height: 60 } } } as LayoutChangeEvent);
    }
  });
}

/** Rows currently clipped to a place that is opening or closing. */
function collapsing(tree: ReactTestRenderer): number {
  return tree.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      (StyleSheet.flatten(node.props.style as ViewStyle | undefined)?.overflow ?? '') === 'hidden',
  ).length;
}

describe('a row leaving or joining DraggableTrackerList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stays in its place while it fades, then goes', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(list(['a', 'b', 'c']));
    });
    layOut(tree);

    act(() => tree.update(list(['a', 'c'], ['a', 'c'])));
    expect(shownNames(tree)).toEqual(['Alpha', 'Beta', 'Gamma']);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(shownNames(tree)).toEqual(['Alpha', 'Gamma']);
    act(() => tree.unmount());
  });

  it('lets the last row of a list fade out too', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(list(['a']));
    });
    layOut(tree);

    act(() => tree.update(list([], [])));
    expect(shownNames(tree)).toEqual(['Alpha']);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(shownNames(tree)).toEqual([]);
    act(() => tree.unmount());
  });

  it('opens a place for a row that arrives after mount, then leaves it be', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(list(['a']));
    });
    // Nothing animates in on mount.
    expect(collapsing(tree)).toBe(0);

    act(() => tree.update(list(['a', 'b'])));
    expect(shownNames(tree)).toEqual(['Alpha', 'Beta']);
    expect(collapsing(tree)).toBe(1);

    layOut(tree);
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(shownNames(tree)).toEqual(['Alpha', 'Beta']);
    expect(collapsing(tree)).toBe(0);
    act(() => tree.unmount());
  });

  it('does not draw a row twice when it comes straight back', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(list(['a', 'b']));
    });
    layOut(tree);

    act(() => tree.update(list(['a'], ['a'])));
    act(() => tree.update(list(['a', 'b'])));

    expect(shownNames(tree)).toEqual(['Alpha', 'Beta']);
    act(() => tree.unmount());
  });
});
