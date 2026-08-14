import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  /** Hide while dictating or saving — chunks are committed takes, not live words. */
  hidden: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

/** Thumb-zone back/forward over committed chunks. Hidden until a chunk exists. */
export function NoteEditorHistoryBar({
  canUndo,
  canRedo,
  hidden,
  onUndo,
  onRedo,
}: Props) {
  const { t } = useTranslation('common');
  if (hidden || (!canUndo && !canRedo)) return null;

  return (
    <View style={styles.row}>
      {canUndo ? (
        <IconButton
          icon="undo"
          onPress={onUndo}
          accessibilityLabel={t('note.undoChunkA11y')}
          size={22}
          style={styles.button}
        />
      ) : null}
      {canRedo ? (
        <IconButton
          icon="redo"
          onPress={onRedo}
          accessibilityLabel={t('note.redoChunkA11y')}
          size={22}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  button: {
    margin: 0,
  },
});
