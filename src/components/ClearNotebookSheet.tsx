import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, List, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import type { JournalNotebook } from '../protocol';

type Props = {
  visible: boolean;
  notebooks: JournalNotebook[];
  busy: boolean;
  onDismiss: () => void;
  onClear: (notebook: JournalNotebook) => Promise<void>;
};

/** Wipe every day in one notebook; the notebook itself stays. */
export default function ClearNotebookSheet({
  visible,
  notebooks,
  busy,
  onDismiss,
  onClear,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const { decorations: deco, isCartoon } = useAppTheme();
  const [clearingId, setClearingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setClearingId(null);
  }, [visible]);

  const confirmClear = (notebook: JournalNotebook) => {
    Alert.alert(
      t('data.clearNotebookConfirmTitle', { name: notebook.name }),
      t('data.clearNotebookConfirmBody'),
      [
        { text: t('data.clearNotebookCancel'), style: 'cancel' },
        {
          text: t('data.clearNotebookConfirmAction'),
          style: 'destructive',
          onPress: () => {
            setClearingId(notebook.id);
            void onClear(notebook).finally(() => setClearingId(null));
          },
        },
      ],
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={busy ? undefined : onDismiss}
        contentContainerStyle={[
          styles.modal,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
            ...(isCartoon && {
              borderWidth: deco.cardBorderWidth,
              borderColor: theme.colors.outline,
            }),
          },
        ]}
      >
        <Text variant="titleMedium">{t('data.clearNotebookTitle')}</Text>
        <Text
          variant="bodySmall"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {t('data.clearNotebookDescription')}
        </Text>
        <View style={styles.list}>
          {notebooks.map((notebook) => (
            <List.Item
              key={notebook.id}
              title={notebook.name}
              left={() => (
                <View style={[styles.swatch, { backgroundColor: notebook.color }]} />
              )}
              onPress={
                busy || clearingId ? undefined : () => confirmClear(notebook)
              }
              disabled={busy || clearingId != null}
            />
          ))}
        </View>
        <Button mode="text" onPress={onDismiss} disabled={busy || clearingId != null}>
          {t('data.clearNotebookClose')}
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 24,
    padding: 16,
    gap: 8,
  },
  subtitle: {
    lineHeight: 20,
  },
  list: {
    marginVertical: 8,
  },
  swatch: {
    width: 16,
    height: 16,
    // Geometric: half the size is what makes it round.
    borderRadius: 8,
    alignSelf: 'center',
    marginLeft: 8,
  },
});
