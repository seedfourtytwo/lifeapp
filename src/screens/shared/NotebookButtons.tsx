import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { HomeNotebookChip } from '../../notes/types';

type Props = {
  notebooks: HomeNotebookChip[];
  /** Tap: today's latest (or a new entry) + dictate. */
  onDictateNotebook: (notebookId: string) => void;
  /** Long-press: today's latest (or a blank editor), no auto-dictate. */
  onEditNotebook: (notebookId: string) => void;
};

/**
 * The journal notebook buttons that sit at the top-right of a Home tab.
 *
 * Split out of the old meta row so the day header and the loading pane can
 * both show them in the same place — the row must not jump once data lands.
 */
export default function NotebookButtons({
  notebooks,
  onDictateNotebook,
  onEditNotebook,
}: Props) {
  if (notebooks.length === 0) return null;

  return (
    <View style={styles.row}>
      {notebooks.map((notebook) => (
        <NoteIconButton
          key={notebook.id}
          hasNote={notebook.hasToday}
          accentColor={notebook.color}
          icon={notebook.icon}
          onPress={() => onDictateNotebook(notebook.id)}
          onLongPress={() => onEditNotebook(notebook.id)}
          accessibilityNoun={notebook.name}
          size={22}
          style={styles.button}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  button: {
    margin: 0,
  },
});
