import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useAppCalendarNow } from '../../hooks/useAppCalendarNow';
import DayHeader from './DayHeader';
import { homeTabScreenStyles } from './screenStyles';

type Props = {
  /**
   * The header's action slot, exactly as the loaded tab will render it — the
   * tracker tabs hand in their notebook buttons, Nutrition its food journal.
   * Whatever it is, it must be the same node the tab shows once data lands,
   * or the row moves the moment the spinner goes.
   */
  actions?: React.ReactNode;
};

/**
 * Spinner shown while the Today page waits for its data.
 *
 * It renders the real day header, not a placeholder: the date and the header
 * buttons are known before any tracker or food data is, so showing them
 * immediately means the top of the screen is already correct and nothing
 * shifts when the rest lands. Only the meta line and the strip wait, and both
 * are optional. The pane itself reads nothing — every action it shows was
 * decided by the tab.
 */
export default function HomeTabLoadingPane({ actions }: Props) {
  const now = useAppCalendarNow();

  return (
    <View style={styles.pane}>
      <DayHeader now={now} actions={actions} />
      <View style={homeTabScreenStyles.centered}>
        <ActivityIndicator size="large" />
      </View>
    </View>
  );
}

const container = StyleSheet.flatten(homeTabScreenStyles.container);

const styles = StyleSheet.create({
  // The loaded tab's own gutters (`homeTabScreenStyles.container`), read from
  // it rather than restated: a pixel of difference moves the header when data lands.
  pane: {
    flex: 1,
    paddingHorizontal: container.paddingHorizontal,
    paddingTop: container.paddingTop,
  },
});
