import React from 'react';
import { View } from 'react-native';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { HomeNotebookChip } from '../../notes/types';
import { homeTabScreenStyles as styles } from './screenStyles';

type Props = {
  notebooks: HomeNotebookChip[];
  /** Tap: today's latest (or a new entry) + dictate. */
  onDictateNotebook: (notebookId: string) => void;
  /** Long-press: today's latest (or a blank editor), no auto-dictate. */
  onEditNotebook: (notebookId: string) => void;
  /** Leading status text / empty spacer. */
  leading?: React.ReactNode;
};

/** Shared Habits/Counters top row: status · notebook icons. */
export default function HomeTabMetaRow({
  notebooks,
  onDictateNotebook,
  onEditNotebook,
  leading,
}: Props) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaStatus}>{leading}</View>
      <View style={styles.metaRight}>
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
            style={styles.metaIconButton}
          />
        ))}
      </View>
    </View>
  );
}
