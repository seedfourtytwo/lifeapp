import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { DayMark } from './dayMarks';
import { DASH_WIDTH, nightColors, nightRadius, nightStroke, space, type NightLight } from './tokens';

type Props = {
  /** Seven days, oldest first. */
  days: readonly DayMark[];
  /** Today's dash. */
  light: NightLight;
  /** What they say: "5 of the last 7 days". */
  accessibilityLabel: string;
};

function dashColor(day: DayMark, light: NightLight): string {
  if (day === 'done') return nightColors.cream;
  if (day === 'today') return nightColors[light];
  if (day === 'missed') return nightColors.missed;
  return nightColors.notCounted;
}

/** The last seven days as small dashes under a name: cream kept, dim missed, barely there when not counted, today lit. */
export function WeekDashes({ days, light, accessibilityLabel }: Props) {
  return (
    <View style={weekDashesStyles.week} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {days.map((day, index) => (
        <View key={index} testID={`dash-${day}`} style={[weekDashesStyles.dash, { backgroundColor: dashColor(day, light) }]} />
      ))}
    </View>
  );
}

export const weekDashesStyles = StyleSheet.create({
  week: {
    flexDirection: 'row',
    gap: space.xs,
    paddingVertical: space.xs,
  },
  dash: {
    width: DASH_WIDTH,
    height: nightStroke.line,
    borderRadius: nightRadius.pill,
  },
});
