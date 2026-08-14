import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

type Props = {
  leading?: React.ReactNode;
  mic: React.ReactNode;
  showDone: boolean;
  showSave: boolean;
  saving: boolean;
  dictationStarting: boolean;
  dictationFinishing: boolean;
  onDone: () => void;
  onSave: () => void;
};

/**
 * Thumb-zone capture row: undo/redo on the left, mic + Done/Save on the right.
 * Share and overflow stay in the header.
 */
export function NoteEditorActions({
  leading,
  mic,
  showDone,
  showSave,
  saving,
  dictationStarting,
  dictationFinishing,
  onDone,
  onSave,
}: Props) {
  const { t } = useTranslation('common');

  return (
    <View style={styles.actions}>
      <View style={styles.leading}>{leading}</View>
      <View style={styles.primary}>
        {mic}
        {showDone ? (
          <Button
            mode="contained"
            onPress={onDone}
            loading={dictationFinishing}
            disabled={dictationStarting || dictationFinishing}
            accessibilityLabel={t('note.finishDictation')}
            contentStyle={styles.primaryContent}
            style={styles.primaryAction}
          >
            {t('actions.done')}
          </Button>
        ) : showSave ? (
          <Button
            mode="contained"
            onPress={onSave}
            loading={saving}
            disabled={saving}
            contentStyle={styles.primaryContent}
            style={styles.primaryAction}
          >
            {t('note.save')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 8,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  primaryAction: {
    flexShrink: 0,
  },
  primaryContent: {
    paddingVertical: 6,
  },
});
