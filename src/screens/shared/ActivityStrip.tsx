import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { space } from '../../theme/spacing';

/** Thin enough to read as texture; half of it rounds each end. */
const CELL_HEIGHT = 6;

/** One cell: a calendar date and whether anything was logged on it. */
export type ActivityDay = {
  date: string;
  active: boolean;
};

type Props = {
  days: ActivityDay[];
  /** Spoken as one phrase — the cells themselves are decoration to a reader. */
  accessibilityLabel: string;
};

/**
 * The recent fortnight as a row of cells, one per day, filled where something
 * was logged.
 *
 * This is the only place on Home that shows more than today. A streak count
 * says "41" and stops; the strip shows the shape — a clean run, a ragged
 * week, the two days you missed. It reads as texture rather than as data,
 * which is the point: it is glanced at, not studied — so it is drawn thin,
 * below the date rather than competing with it.
 *
 * Purely presentational, so it can be rendered from a test without a database.
 */
export default function ActivityStrip({ days, accessibilityLabel }: Props) {
  const theme = useTheme();

  if (days.length === 0) return null;

  return (
    <View
      style={styles.strip}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {days.map((day) => (
        <View
          key={day.date}
          style={[
            styles.cell,
            {
              borderRadius: CELL_HEIGHT / 2,
              backgroundColor: day.active
                ? theme.colors.primary
                : theme.colors.outlineVariant,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.md,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
  },
});
