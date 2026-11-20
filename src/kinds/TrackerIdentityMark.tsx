import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { useAppTheme } from '../hooks/useAppTheme';
import type { KindColour } from '../theme/palette';
import { ROW_KIND_GLYPHS } from './rowKind';

/** The tile on a live row, and the column a settled row's smaller tile sits in. */
export const ROW_TILE_SIZE = 40;
const SMALL_TILE_SIZE = 28;

type Props = {
  /** Whose colour the tile wears. */
  kind: KindColour;
  /** The row's own icon; without one the tile draws its kind's glyph. */
  icon?: TrackerIconId | null;
  /** The slim tile of a settled row. */
  small?: boolean;
};

/**
 * A row's leading tile, as on the lock-screen widget: a rounded square in the
 * kind's colour with the row's glyph on it. The colour says what sort of row
 * this is before the words do.
 */
export function TrackerIdentityMark({ kind, icon = null, small = false }: Props) {
  const { decorations: deco, palette } = useAppTheme();
  const size = small ? SMALL_TILE_SIZE : ROW_TILE_SIZE;
  const glyphSize = small ? 16 : 22;

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: small ? deco.radius.sm : deco.radius.md,
          backgroundColor: palette.kind[kind].ink,
        },
      ]}
    >
      {icon ? (
        <TrackerIcon name={icon} size={glyphSize} color={palette.onKind} />
      ) : (
        <MaterialCommunityIcons name={ROW_KIND_GLYPHS[kind]} size={glyphSize} color={palette.onKind} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
