import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

/**
 * - `done`: a check — ticked, timed, finished.
 * - `skipped`: a dash — let go for today.
 */
export type TodayMarkKind = 'done' | 'skipped';

const SIZE = 30;

/**
 * The mark at the end of a settled row: a filled disc in the tick colour,
 * whatever kind the row is. Done is the same green everywhere, as on the
 * widget (`life_widget_tick_done`).
 */
export default function TodayMark({ kind }: { kind: TodayMarkKind }) {
  const { palette } = useAppTheme();

  return (
    <View style={[styles.disc, { backgroundColor: palette.kind.tick.ink }]}>
      <MaterialCommunityIcons
        name={kind === 'skipped' ? 'minus' : 'check'}
        size={18}
        color={palette.onKind}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: SIZE,
    height: SIZE,
    // Geometry: a circle.
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
