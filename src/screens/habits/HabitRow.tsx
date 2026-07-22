import React from 'react';
import { View } from 'react-native';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import ReorderControls from '../shared/ReorderControls';
import { homeTabScreenStyles as styles } from '../shared/screenStyles';
import HabitCard from './HabitCard';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  reordering: boolean;
  /** Quieter presentation for completed habits. */
  dimmed?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  hasTodayNote?: boolean;
  onOpenNote?: () => void;
};

export default function HabitRow({
  habit,
  config,
  reordering,
  dimmed = false,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  hasTodayNote,
  onOpenNote,
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
        <HabitCard
          habit={habit}
          config={config}
          hasTodayNote={hasTodayNote}
          onOpenNote={onOpenNote}
        />
      </View>
    </View>
  );
}
