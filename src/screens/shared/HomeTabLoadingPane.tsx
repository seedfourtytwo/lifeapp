import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useAppCalendarNow } from '../../hooks/useAppCalendarNow';
import type { HomeNotebookChip } from '../../notes';
import { space } from '../../theme/spacing';
import DayHeader from './DayHeader';
import NotebookButtons from './NotebookButtons';
import { homeTabScreenStyles } from './screenStyles';

type Props = {
  notebooks: HomeNotebookChip[];
  onDictateNotebook: (notebookId: string) => void;
  onEditNotebook: (notebookId: string) => void;
};

/**
 * Spinner shown while a Home tracker tab waits for elements or today's state.
 *
 * It renders the real day header, not a placeholder: the date and the journal
 * buttons are known before any tracker data is, so showing them immediately
 * means the top of the screen is already correct and nothing shifts when the
 * rest lands. Only the meta line and the strip wait, and both are optional.
 */
export default function HomeTabLoadingPane({
  notebooks,
  onDictateNotebook,
  onEditNotebook,
}: Props) {
  const now = useAppCalendarNow();

  return (
    <View style={styles.pane}>
      <DayHeader
        now={now}
        actions={
          <NotebookButtons
            notebooks={notebooks}
            onDictateNotebook={onDictateNotebook}
            onEditNotebook={onEditNotebook}
          />
        }
      />
      <View style={homeTabScreenStyles.centered}>
        <ActivityIndicator size="large" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
});
