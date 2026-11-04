/**
 * Journal and calendar surfaces, rendered.
 *
 * A notebook's colour is identity, not decoration: it shows only as a small
 * dot beside an ink glyph, the way the Home notebook buttons draw it. A whole
 * glyph painted orange or amber is what made the journal look like a toy box.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import NotebookMark from '../src/screens/journal/NotebookMark';
import { appLightTheme } from '../src/theme/themes';
import { notebookInk } from '../src/notes/notebookInk';

const METRICS = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        { initialMetrics: METRICS },
        React.createElement(PaperProvider, { theme: appLightTheme, children: element }),
      ),
    );
  });
  return tree;
}

const styleOf = (style: unknown): ViewStyle =>
  StyleSheet.flatten(style as StyleProp<ViewStyle>);

describe('notebook mark', () => {
  it('paints the glyph in ink and the notebook colour only as a 7dp dot', () => {
    const tree = render(
      React.createElement(NotebookMark, { notebook: { color: '#CA8A04' }, size: 22 }),
    );
    const glyphColors = tree.root
      .findAll((node) => typeof node.props.name === 'string' && node.props.color != null)
      .map((node) => node.props.color as string);
    expect(glyphColors.length).toBeGreaterThan(0);
    const ink = notebookInk('#CA8A04', 'light');
    expect(glyphColors).not.toContain(ink);
    expect(glyphColors).toContain(appLightTheme.colors.onSurfaceVariant);

    const dot = tree.root.findAll((node) => node.props.testID === 'notebook-dot')[0];
    const box = styleOf(dot.props.style);
    expect(box.backgroundColor).toBe(ink);
    // 7dp of colour inside its ring of ground.
    expect((box.width as number) - 2 * (box.borderWidth as number)).toBe(7);
  });

  it('can draw the glyph in another ink when it is the picked one', () => {
    const tree = render(
      React.createElement(NotebookMark, {
        notebook: { color: '#2563EB', icon: 'book-open-variant' },
        size: 22,
        glyphColor: appLightTheme.colors.primary,
      }),
    );
    const colors = tree.root
      .findAll((node) => typeof node.props.name === 'string' && node.props.color != null)
      .map((node) => node.props.color as string);
    expect(colors).toContain(appLightTheme.colors.primary);
  });
});
