/**
 * The note and notebook buttons, rendered.
 *
 * One icon family: the glyph is ink, never the notebook's colour. A notebook
 * shows its colour only as a small dot on its icon, so four notebooks read as
 * four marks in one set rather than four loud glyphs. A note written today
 * darkens the glyph onto a quiet well, and the press wash is a round ink tint
 * the size of the button, not a ripple across the row.
 */
import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { IconButton, PaperProvider } from 'react-native-paper';
import { NoteIconButton, noteIconButtonStyles } from '../src/notes/NoteIconButton';
import { StickyNoteMicIcon } from '../src/notes/StickyNoteMicIcon';
import { TrackerIcon } from '../src/components/trackerIcons/TrackerIcon';
import { appLightTheme } from '../src/theme/themes';
import { withAlpha } from '../src/utils/color';

const theme = appLightTheme;

type ButtonProps = React.ComponentProps<typeof NoteIconButton>;
type Style = Record<string, unknown>;

function render(props: Partial<ButtonProps> = {}): ReactTestInstance {
  const all: ButtonProps = { hasNote: false, onPress: () => {}, ...props };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(PaperProvider, { theme, children: React.createElement(NoteIconButton, all) }),
    );
  });
  return tree.root;
}

const dots = (root: ReactTestInstance) =>
  root.findAll((node) => node.props.testID === 'notebook-dot' && typeof node.type !== 'string');

/** A style prop's arrays and nulls, flattened into one object. */
const flat = (style: unknown): Style => Object.assign({}, ...[style].flat(3).filter(Boolean)) as Style;

const glyphColor = (root: ReactTestInstance) => {
  const [glyph] = [
    ...root.findAllByType(StickyNoteMicIcon),
    ...root.findAllByType(TrackerIcon),
  ];
  return glyph.props.color as string;
};

describe('NoteIconButton', () => {
  it('draws an idle glyph in the quiet ink', () => {
    expect(glyphColor(render())).toBe(theme.colors.onSurfaceVariant);
  });

  it('darkens to ink when there is a note today', () => {
    expect(glyphColor(render({ hasNote: true }))).toBe(theme.colors.onSurface);
  });

  it("keeps a notebook's colour off the glyph and on a dot", () => {
    const root = render({ dotColor: '#8F5400', icon: 'notebook-outline' });
    expect(glyphColor(root)).toBe(theme.colors.onSurfaceVariant);
    const [dot] = dots(root);
    const style = flat(dot.props.style);
    expect(style.backgroundColor).toBe('#8F5400');
    // 7dp of colour inside its ring of page ground.
    expect((style.width as number) - 2 * (style.borderWidth as number)).toBe(7);
  });

  it('shows no dot for a plain note', () => {
    expect(dots(render())).toHaveLength(0);
  });

  it('is a 48dp target with a round ink press wash', () => {
    const button = render().findByType(IconButton);
    expect(button.props.rippleColor).toBe(withAlpha(theme.colors.onSurface, 0.08));
    const style = flat(button.props.style);
    expect(style.width).toBe(48);
    expect(style.height).toBe(48);
    expect(style.borderRadius).toBe(24);
  });

  it('keeps the chapter count clear of the dot', () => {
    const badge: Style = noteIconButtonStyles.badge;
    expect(badge.bottom).toBe(0);
    expect(badge.top).toBeUndefined();
  });
});
