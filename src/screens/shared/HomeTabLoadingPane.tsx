import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import type { HomeNotebookChip } from '../../notes';
import HomeTabMetaRow from './HomeTabMetaRow';
import { homeTabScreenStyles } from './screenStyles';

type Props = {
  notebooks: HomeNotebookChip[];
  onDictateNotebook: (notebookId: string) => void;
  onEditNotebook: (notebookId: string) => void;
};

/**
 * Spinner shown while a Home tracker tab waits for elements or today's state.
 * Keeps the journal chips visible so the row does not jump once data lands.
 */
export default function HomeTabLoadingPane({
  notebooks,
  onDictateNotebook,
  onEditNotebook,
}: Props) {
  return (
    <View style={styles.pane}>
      <HomeTabMetaRow
        notebooks={notebooks}
        onDictateNotebook={onDictateNotebook}
        onEditNotebook={onEditNotebook}
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
