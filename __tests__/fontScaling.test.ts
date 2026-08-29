/**
 * Layout has to survive a large system font.
 *
 * Android font scaling runs to 2.0x, and 1.3x is an ordinary setting rather
 * than an extreme one. Two rules keep the app usable there:
 *
 *  - a box that holds text states a *floor* (`minHeight`), never a fixed
 *    `height`, so it grows with its contents;
 *  - text that genuinely cannot reflow — pinned to a corner, or one column of
 *    a dense axis — caps its own multiplier instead of overrunning neighbours.
 *
 * The second rule is a last resort: capping costs legibility, so it is spent
 * only where growing would break the layout outright. Everything else is left
 * free to scale.
 *
 * What this file cannot check is how any of it looks. Fixed heights are the
 * failure mode visible in source; the rest needs the device.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { trackerCardStyles } from '../src/kinds/trackerCardStyles';
import { StreakFireCount } from '../src/kinds/StreakFireCount';

type Style = Record<string, unknown>;

describe('boxes that hold text state a floor, not a fixed height', () => {
  it('the tracker row has a minHeight and no fixed height', () => {
    const row = trackerCardStyles.oneLineRow as Style;
    expect(row.minHeight).toEqual(expect.any(Number));
    expect(row.height).toBeUndefined();
  });

  it('the running timer shrinks rather than clipping at a fixed width', () => {
    const timer = trackerCardStyles.timerLabel as Style;
    expect(timer.maxWidth).toBeUndefined();
    expect(timer.flexShrink).toBe(1);
  });

  /**
   * The icon buttons keep a fixed 48pt box on purpose: they hold no text, and a
   * touch target should not move because the system font changed.
   */
  it('leaves textless touch targets at a fixed size', () => {
    const button = trackerCardStyles.iconButton as Style;
    expect(button.width).toBe(48);
    expect(button.height).toBe(48);
  });
});

describe('text that cannot reflow caps its own scaling', () => {
  type Node = { props?: Record<string, unknown>; children?: Node[] | null } | string | null;

  /** Every `maxFontSizeMultiplier` in the rendered host tree, in order. */
  function fontCaps(node: Node, found: unknown[] = []): unknown[] {
    if (node == null || typeof node === 'string') return found;
    if (node.props && 'maxFontSizeMultiplier' in node.props) {
      found.push(node.props.maxFontSizeMultiplier);
    }
    for (const child of node.children ?? []) fontCaps(child, found);
    return found;
  }

  function streakFontCaps(variant: 'badge' | 'inline'): unknown[] {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(StreakFireCount, { days: 41, color: '#000000', variant }),
      );
    });
    const caps = fontCaps(tree.toJSON() as Node);
    act(() => {
      tree.unmount();
    });
    return caps;
  }

  it('caps the streak badge, which is pinned over the identity mark', () => {
    const caps = streakFontCaps('badge');
    expect(caps).toEqual([expect.any(Number)]);
    expect(caps[0] as number).toBeGreaterThan(1);
    expect(caps[0] as number).toBeLessThanOrEqual(1.5);
  });

  it('leaves the inline streak count free to scale', () => {
    // Same content, but in a normal row where growing is fine.
    expect(streakFontCaps('inline')).toEqual([]);
  });
});
