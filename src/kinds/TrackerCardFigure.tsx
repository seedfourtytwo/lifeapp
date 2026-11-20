import React from 'react';
import { Text, useTheme } from 'react-native-paper';
import { splitRowFigure } from './rowFigure';
import { trackerCardStyles as styles } from './trackerCardStyles';

/**
 * A row's figure in the mono face. In "done / goal" the done part is read
 * first, so it takes the text colour; the slash, the goal and any lone figure
 * take the quiet one.
 */
export function TrackerCardFigure({ figure }: { figure: string }) {
  const { colors } = useTheme();
  const { done, rest } = splitRowFigure(figure);

  return (
    <Text
      numberOfLines={1}
      style={[styles.timerLabel, { color: colors.onSurfaceVariant }]}
      accessibilityLabel={figure}
    >
      {done ? <Text style={{ color: colors.onSurface }}>{done}</Text> : null}
      {rest}
    </Text>
  );
}
