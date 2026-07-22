import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

type Props = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  accessibilityNoun?: string;
};

/** Compact up/down controls for Home list reorder mode. */
export default function ReorderControls({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  accessibilityNoun,
}: Props) {
  const { t } = useTranslation('common');
  const noun = accessibilityNoun ?? t('actions.itemNoun');
  return (
    <View style={styles.controls}>
      <IconButton
        icon="chevron-up"
        size={22}
        disabled={!canMoveUp}
        onPress={onMoveUp}
        accessibilityLabel={t('actions.moveNounUp', { noun })}
      />
      <IconButton
        icon="chevron-down"
        size={22}
        disabled={!canMoveDown}
        onPress={onMoveDown}
        accessibilityLabel={t('actions.moveNounDown', { noun })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    justifyContent: 'center',
  },
});
