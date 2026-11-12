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
import '../src/i18n';
import { TrackerCardTitle } from '../src/kinds/TrackerCardTitle';
import { forecastStripStyles } from '../src/components/weather/WeatherForecastStrip';
import { noteIconButtonStyles } from '../src/notes/NoteIconButton';
import { glassSurfaceStyles } from '../src/ui/GlassSurface';
import { pillButtonStyles } from '../src/ui/PillButton';
import { roundButtonStyles } from '../src/ui/RoundButton';
import { nightRadius, roundSize } from '../src/ui/tokens';
import { fieldStyles } from '../src/ui/Field';
import { chipStyles } from '../src/ui/Chip';
import { rowStyles } from '../src/ui/Row';
import { screenHeaderStyles } from '../src/ui/ScreenHeader';
import { segmentedStyles } from '../src/ui/Segmented';
import { textButtonStyles } from '../src/ui/TextButton';
import { undoBarStyles } from '../src/ui/UndoBar';

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
   * The journal chapter count sits in the corner of the note icon. It is text,
   * so it takes a floor and grows — but only so far: the cap beside it in
   * NoteIconButton is what keeps two digits from sliding off the glyph.
   */
  it('the chapter count capsule states a floor and no fixed height', () => {
    const badge = noteIconButtonStyles.badge as Style;
    expect(badge.minHeight).toEqual(expect.any(Number));
    expect(badge.height).toBeUndefined();
    expect(badge.minWidth).toEqual(expect.any(Number));
    expect(badge.width).toBeUndefined();
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

  /**
   * The forecast row used to be a fixed 100pt box floating beside the weather
   * bubble, sized in pixels because its position was too. Inside the peek
   * sheet it is a normal block of five stacked labels per column, so it takes
   * a floor and grows.
   */
  it('the forecast strip states a floor and no fixed height or width', () => {
    const strip = forecastStripStyles.strip as Style;
    expect(strip.minHeight).toEqual(expect.any(Number));
    expect(strip.height).toBeUndefined();
    expect(strip.width).toBeUndefined();

    const column = forecastStripStyles.dayCol as Style;
    expect(column.height).toBeUndefined();
    expect(column.width).toBeUndefined();
    // Columns share the row evenly instead of each claiming 52pt.
    expect(column.flex).toBe(1);
  });
});

describe('the Night road kit grows with the system font', () => {
  it.each([
    ['a pill button', pillButtonStyles.pill as Style],
    ['a field', fieldStyles.field as Style],
    ['a row', rowStyles.row as Style],
    ['a segment', segmentedStyles.segment as Style],
    ['a text button', textButtonStyles.button as Style],
    ['the undo bar', undoBarStyles.bar as Style],
    ['a screen header', screenHeaderStyles.header as Style],
  ])('%s states a floor and no fixed height', (_label, style) => {
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.height).toBeUndefined();
  });

  /** Smaller to the eye; its slop makes up the touch target. */
  it.each([
    ['a chip', chipStyles.chip as Style],
    ['a compact pill', pillButtonStyles.compact as Style],
  ])('%s states a floor and no fixed height or width', (_label, style) => {
    expect(style.minHeight).toBeGreaterThanOrEqual(40);
    expect(style.height).toBeUndefined();
    expect(style.width).toBeUndefined();
  });

  it('a glass surface takes the height of what it holds', () => {
    const surface = glassSurfaceStyles.surface as Style;
    expect(surface.height).toBeUndefined();
    expect(surface.minHeight).toBeUndefined();
  });

  /**
   * With an icon it holds no text: a touch target should not move with the
   * font, and every size reaches one. With characters ("+1") it states a
   * floor instead, and grows into a capsule.
   */
  it.each(Object.entries(roundSize))('a %s round button keeps one size, at least a touch target', (_size, { box }) => {
    expect(box).toBeGreaterThanOrEqual(48);
    expect(roundButtonStyles.button.borderRadius).toBe(nightRadius.pill);
  });

  it('a round button with characters states a floor and grows', () => {
    const characters = roundButtonStyles.characters as Style;
    expect(characters.height).toBeUndefined();
    expect(characters.width).toBeUndefined();
    expect(characters.paddingHorizontal).toEqual(expect.any(Number));
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

  it('leaves the streak caption under a row name free to scale', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(TrackerCardTitle, { name: 'Read', streakLabel: '41 days in a row' }),
      );
    });
    // It sits on its own line under the name, where growing is fine.
    expect(fontCaps(tree.toJSON() as Node)).toEqual([]);
    act(() => {
      tree.unmount();
    });
  });
});
