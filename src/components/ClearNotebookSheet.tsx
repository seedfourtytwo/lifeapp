import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { JournalNotebook } from '../protocol';
import { space } from '../theme/spacing';
import SettingsRow, { settingsRowStyles } from './settings/SettingsRow';
import { confirm, EditorSheet } from './sheet';

type Props = {
  visible: boolean;
  notebooks: JournalNotebook[];
  busy: boolean;
  onDismiss: () => void;
  onClear: (notebook: JournalNotebook) => Promise<void>;
};

const SWATCH = 16;

/** Wipe every day in one notebook; the notebook itself stays. */
export default function ClearNotebookSheet({
  visible,
  notebooks,
  busy,
  onDismiss,
  onClear,
}: Props) {
  const { t } = useTranslation('settings');
  const [clearingId, setClearingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setClearingId(null);
  }, [visible]);

  const working = busy || clearingId != null;

  const confirmClear = async (notebook: JournalNotebook) => {
    const confirmed = await confirm({
      title: t('data.clearNotebookConfirmTitle', { name: notebook.name }),
      message: t('data.clearNotebookConfirmBody'),
      confirmLabel: t('data.clearNotebookConfirmAction'),
      destructive: true,
    });
    if (!confirmed) return;
    setClearingId(notebook.id);
    try {
      await onClear(notebook);
    } finally {
      setClearingId(null);
    }
  };

  return (
    <EditorSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!working}
      title={t('data.clearNotebookTitle')}
      subtitle={t('data.clearNotebookDescription')}
    >
      <View style={styles.list}>
        {notebooks.map((notebook) => (
          <SettingsRow
            key={notebook.id}
            title={notebook.name}
            left={
              <View style={settingsRowStyles.iconSlot}>
                <View style={[styles.swatch, { backgroundColor: notebook.color }]} />
              </View>
            }
            onPress={() => void confirmClear(notebook)}
            busy={clearingId === notebook.id}
            disabled={working}
          />
        ))}
      </View>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    // The rows carry their own gutter; pull them back onto the sheet's.
    marginHorizontal: -space.lg,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    // Geometric: half the size is what makes it round.
    borderRadius: SWATCH / 2,
  },
});
