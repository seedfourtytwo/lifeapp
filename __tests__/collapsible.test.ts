/**
 * A collapsible body: not mounted while shut, mounted the moment it opens, and
 * gone again only once it has finished closing — so the close is seen.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Text } from 'react-native';
import { Collapsible, COLLAPSE_MS } from '../src/components/Collapsible';

const body = (open: boolean) =>
  React.createElement(Collapsible, { open, children: React.createElement(Text, null, 'Inside') });

const shows = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).length > 0;

let tree: ReactTestRenderer;

function mount(open: boolean): void {
  act(() => {
    tree = TestRenderer.create(body(open));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  // Motion stays on unless a test says otherwise; the real lookup settles late.
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(new Promise<boolean>(() => undefined));
});

afterEach(() => {
  act(() => tree.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Collapsible', () => {
  it('mounts nothing while shut', () => {
    mount(false);
    expect(shows(tree)).toBe(false);
  });

  it('mounts its body as soon as it opens', () => {
    mount(false);
    act(() => tree.update(body(true)));
    expect(shows(tree)).toBe(true);
  });

  it('keeps the body through the close, then lets it go', () => {
    mount(true);
    act(() => tree.update(body(false)));
    expect(shows(tree)).toBe(true);
    act(() => {
      jest.advanceTimersByTime(COLLAPSE_MS + 100);
    });
    expect(shows(tree)).toBe(false);
  });

  it('releases the measured height once open, so the body can grow', () => {
    mount(true);
    const [clip] = tree.root.findAll(
      (n) => n.props.testID === 'collapsible' && typeof n.type === 'string',
    );
    expect([clip.props.style].flat(Infinity)).not.toContainEqual(
      expect.objectContaining({ height: expect.anything() }),
    );
  });

  it('closes at once when the phone asks for no animation', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    mount(true);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => tree.update(body(false)));
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(shows(tree)).toBe(false);
  });
});
