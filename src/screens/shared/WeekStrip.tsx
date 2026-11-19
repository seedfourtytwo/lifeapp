import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDateLocale } from '../../i18n';
import { parseLocalDate } from '../../protocol';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import type { WeekDay } from '../today/weekActivity';

/** A full day's column. */
const HEIGHT = 32;
const COLUMN = 14;
/** The tick a day that has come and gone empty leaves on the baseline. */
const TICK = 2;

/** A column standing on the baseline, centred in its seventh of `width`. */
function columnPath(index: number, count: number, width: number, height: number): string {
  const slot = width / count;
  const left = index * slot + (slot - COLUMN) / 2;
  const right = left + COLUMN;
  // Flat base, rounded top — and a tick too short to round is a plain bar.
  const radius = Math.min(COLUMN / 2, height);
  const top = HEIGHT - height;
  return [
    `M${left},${HEIGHT}`,
    `L${left},${top + radius}`,
    `A${radius},${radius} 0 0 1 ${left + radius},${top}`,
    `L${right - radius},${top}`,
    `A${radius},${radius} 0 0 1 ${right},${top + radius}`,
    `L${right},${HEIGHT}`,
    'Z',
  ].join(' ');
}

function weekdayInitial(date: string): string {
  return parseLocalDate(date).toLocaleDateString(getDateLocale(), { weekday: 'narrow' });
}

type Props = {
  /** Monday to Sunday; empty draws nothing. */
  days: WeekDay[];
  /** Spoken as one sentence — the columns themselves are decoration to a reader. */
  accessibilityLabel: string;
};

/**
 * This week under the date: seven equal columns across the page, Monday to
 * Sunday, each as tall as the share of trackers logged that day. A day that
 * went by empty leaves a tick, so the week always reads as seven slots; days
 * to come are bare. Today's initial is in the accent and its column rises as
 * things are ticked.
 *
 * A row of fourteen did-anything cells sat here before, and for anyone using
 * the app it was always full — it said nothing. Height says how much of the
 * day got done, which is the thing a week is judged by.
 *
 * Purely presentational, so it can be rendered from a test without a database.
 */
export default function WeekStrip({ days, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { palette } = useAppTheme();
  // The columns are drawn in one Svg, which needs the width the page gave it.
  const [width, setWidth] = useState(0);
  if (days.length === 0) return null;

  const paths = (pick: (day: WeekDay) => number | null) =>
    days
      .map((day, index) => {
        const height = pick(day);
        return height == null ? null : columnPath(index, days.length, width, height);
      })
      .filter((path): path is string => path != null)
      .join(' ');
  const ticks = paths((day) => (day.when !== 'future' && day.share === 0 ? TICK : null));
  const filled = paths((day) => (day.share > 0 ? Math.max(TICK, day.share * HEIGHT) : null));

  return (
    <View
      style={styles.strip}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      <Svg width={width} height={HEIGHT}>
        {width > 0 ? (
          <>
            <Path d={ticks} fill={palette.track} />
            <Path d={filled} fill={theme.colors.primary} />
          </>
        ) : null}
      </Svg>
      <View style={styles.initials} importantForAccessibility="no-hide-descendants">
        {days.map((day) => (
          <Text
            key={day.date}
            numberOfLines={1}
            style={[
              typeScale.caption,
              styles.initial,
              {
                color: day.when === 'today' ? theme.colors.primary : theme.colors.onSurfaceVariant,
              },
            ]}
          >
            {weekdayInitial(day.date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginTop: space.md,
  },
  initials: {
    flexDirection: 'row',
    marginTop: space.xs,
  },
  // Seven equal shares of the row, so each initial sits under its column.
  initial: {
    flex: 1,
    textAlign: 'center',
  },
});
