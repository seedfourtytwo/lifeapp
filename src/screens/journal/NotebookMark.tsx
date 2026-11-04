import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { TrackerIcon } from '../../components/trackerIcons/TrackerIcon';
import { useAppTheme } from '../../hooks/useAppTheme';
import { notebookInk } from '../../notes/notebookInk';
import type { JournalNotebook } from '../../protocol';

/** A notebook's colour mark; half of it is its radius. */
const DOT = 7;
/** The ring that lifts the dot off the glyph, in whatever it sits on. */
const DOT_RING = 2;

type Props = {
  notebook: Pick<JournalNotebook, 'color' | 'icon'>;
  size?: number;
  /** Ink for the glyph. Defaults to the quiet ink every idle icon uses. */
  glyphColor?: string;
  /** What the mark sits on, so the dot's ring matches it. Defaults to the tile. */
  ringColor?: string;
};

/**
 * A notebook's glyph in ink, with its colour as a small dot at the top right —
 * the same mark the Home notebook buttons draw, so a notebook looks like
 * itself on every screen.
 */
export default function NotebookMark({ notebook, size = 22, glyphColor, ringColor }: Props) {
  const theme = useTheme();
  const { themeMode } = useAppTheme();
  const ink = glyphColor ?? theme.colors.onSurfaceVariant;

  return (
    <View style={{ width: size, height: size }}>
      {notebook.icon ? (
        <TrackerIcon name={notebook.icon} size={size} color={ink} />
      ) : (
        <MaterialCommunityIcons name="notebook-outline" size={size} color={ink} />
      )}
      <View
        testID="notebook-dot"
        pointerEvents="none"
        style={[
          styles.dot,
          {
            backgroundColor: notebookInk(notebook.color, themeMode),
            borderColor: ringColor ?? theme.colors.surface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -DOT_RING - 1,
    right: -DOT_RING - 2,
    width: DOT + DOT_RING * 2,
    height: DOT + DOT_RING * 2,
    // Geometry: half the box is what makes the dot round.
    borderRadius: DOT / 2 + DOT_RING,
    borderWidth: DOT_RING,
  },
});
