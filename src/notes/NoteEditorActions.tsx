import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

type Props = {
  noun: string;
  showShare: boolean;
  showDone: boolean;
  showSave: boolean;
  sharing: boolean;
  saving: boolean;
  isDirty: boolean;
  shareTextColor: string;
  shareStatusA11y: string;
  dictationStarting: boolean;
  dictationFinishing: boolean;
  onShare: () => void;
  onDone: () => void;
  onSave: () => void;
};

/** Thumb-zone Share + Done/Save for the note sheet. */
export function NoteEditorActions({
  noun,
  showShare,
  showDone,
  showSave,
  sharing,
  saving,
  isDirty,
  shareTextColor,
  shareStatusA11y,
  dictationStarting,
  dictationFinishing,
  onShare,
  onDone,
  onSave,
}: Props) {
  const { t } = useTranslation('common');
  if (!showShare && !showDone && !showSave) return null;

  return (
    <View style={[styles.actions, !showShare ? styles.actionsPrimaryOnly : null]}>
      {showShare ? (
        <Button
          mode="text"
          compact
          icon="share-variant"
          onPress={onShare}
          loading={sharing}
          disabled={sharing}
          textColor={shareTextColor}
          accessibilityLabel={`${t('note.shareA11y', { noun })}. ${shareStatusA11y}`}
          style={styles.shareButton}
          labelStyle={styles.shareLabel}
        >
          {t('note.share')}
        </Button>
      ) : null}
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
          disabled={saving || !isDirty}
          contentStyle={styles.primaryContent}
          style={styles.primaryAction}
        >
          {t('note.save')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 44,
  },
  actionsPrimaryOnly: {
    justifyContent: 'flex-end',
  },
  shareButton: {
    marginHorizontal: 0,
    marginLeft: -8,
    minHeight: 44,
    justifyContent: 'center',
  },
  shareLabel: {
    marginLeft: 4,
  },
  primaryAction: {
    flexShrink: 0,
  },
  primaryContent: {
    paddingVertical: 6,
  },
});
