import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

type Props = {
  title: string;
  /** Buttons on the right, level with the title — the page's one or two actions. */
  actions?: React.ReactNode;
};

/**
 * The top of a Home page that is not a day: Journal, More.
 *
 * It is the day header's title row with a name in place of the date — the same
 * floor, the same edges, the display face — so swiping between pages does not
 * move the title. A page puts it where it would put `DayHeader`: first thing
 * inside its scroll view, inside the gutter. It carries no margin below; the
 * page's own gap sets that.
 */
export default function PageHeader({ title, actions }: Props) {
  const theme = useTheme();

  return (
    <View style={pageHeaderStyles.row}>
      <Text
        style={[typeScale.screenTitle, pageHeaderStyles.title, { color: theme.colors.onSurface }]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {actions ? <View style={pageHeaderStyles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Exported so a test can hold the row to the day header's floor. */
export const pageHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    // The day header's title row: a floor, so a large font grows it.
    minHeight: 40,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
