import React from 'react';
import { View } from 'react-native';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import ReorderControls from '../shared/ReorderControls';
import { homeTabScreenStyles as styles } from '../shared/screenStyles';
import HabitDailyCard from './HabitDailyCard';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  reordering: boolean;
  /** Quieter presentation for completed habits in All today. */
  dimmed?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export default function HabitDailyRow({
  habit,
  config,
  reordering,
  dimmed = false,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: Props) {
  return (
    <View style={styles.reorderRow}>
      {reordering ? (
        <ReorderControls
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          accessibilityNoun="habit"
        />
      ) : null}
      <View style={[styles.reorderCard, dimmed ? styles.dimmedCard : null]}>
        <HabitDailyCard habit={habit} config={config} />
      </View>
    </View>
  );
}
