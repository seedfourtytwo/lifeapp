import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';

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
  accessibilityNoun = 'item',
}: Props) {
  return (
    <View style={styles.controls}>
      <IconButton
        icon="chevron-up"
        size={22}
        disabled={!canMoveUp}
        onPress={onMoveUp}
        accessibilityLabel={`Move ${accessibilityNoun} up`}
      />
      <IconButton
        icon="chevron-down"
        size={22}
        disabled={!canMoveDown}
        onPress={onMoveDown}
        accessibilityLabel={`Move ${accessibilityNoun} down`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    justifyContent: 'center',
  },
});
