import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import HabitDailyCard from './HabitDailyCard';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  reordering: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export default function HabitDailyRow({
  habit,
  config,
  reordering,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: Props) {
  return (
    <View style={styles.row}>
      {reordering ? (
        <View style={styles.controls}>
          <IconButton
            icon="chevron-up"
            size={22}
            disabled={!canMoveUp}
            onPress={onMoveUp}
            accessibilityLabel="Move habit up"
          />
          <IconButton
            icon="chevron-down"
            size={22}
            disabled={!canMoveDown}
            onPress={onMoveDown}
            accessibilityLabel="Move habit down"
          />
        </View>
      ) : null}
      <View style={styles.card}>
        <HabitDailyCard habit={habit} config={config} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  controls: {
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    minWidth: 0,
  },
});
