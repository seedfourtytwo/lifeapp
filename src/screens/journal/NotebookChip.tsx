import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { notebookInk } from '../../notes/notebookInk';
import type { JournalNotebook } from '../../protocol';
import { space } from '../../theme/spacing';

/** The notebook's colour mark; half of it is its radius. */
const DOT = 8;
const HEIGHT = 40;
/** Grows the 40dp pill to a 48dp touch target without making it look bigger. */
const HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

type Props = {
  /** The word on the chip: a notebook's name, or "All". */
  label: string;
  /** The notebook this chip stands for; none for "All", which has no dot. */
  notebook?: Pick<JournalNotebook, 'color'>;
  selected: boolean;
  onPress: () => void;
  /** What the chip sits on, so an unpicked one still shows against it. */
  ground: 'tile' | 'page';
};

/**
 * A notebook as a word you can read: its colour dot, then its name. It is
 * `ChoiceChip`'s pill — same height, same moss fill for the pick — with the
 * dot added, because a notebook's glyph alone told nobody which one it was.
 */
export default function NotebookChip({ label, notebook, selected, onPress, ground }: Props) {
  const theme = useTheme();
  const { decorations: deco, themeMode } = useAppTheme();
  const rest = ground === 'tile' ? theme.colors.background : theme.colors.surface;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      android_ripple={{ color: theme.colors.outlineVariant }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : rest,
          borderRadius: deco.radius.pill,
        },
      ]}
    >
      {notebook ? (
        <View
          testID="notebook-chip-dot"
          style={[
            styles.dot,
            {
              // On the moss fill a hue would not read; the pick's dot takes the label's ink.
              backgroundColor: selected
                ? theme.colors.onPrimary
                : notebookInk(notebook.color, themeMode),
            },
          ]}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.label, { color: selected ? theme.colors.onPrimary : theme.colors.onSurface }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: HEIGHT,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    overflow: 'hidden',
  },
  dot: {
    width: DOT,
    height: DOT,
    // Geometry: half the box is what makes the dot round.
    borderRadius: DOT / 2,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});
