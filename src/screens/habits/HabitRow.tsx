import React from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import { homeTabScreenStyles as styles } from '../shared/screenStyles';
import HabitCard from './HabitCard';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  /** Quieter presentation for completed habits. */
  dimmed?: boolean;
  hasTodayNote?: boolean;
  onDictateNote?: () => void;
  onEditNote?: () => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
};

export default function HabitRow({
  habit,
  config,
  dimmed = false,
  hasTodayNote,
  onDictateNote,
  onEditNote,
  onLongPressReorder,
  delayLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  reorderHint,
}: Props) {
  return (
    <View style={dimmed ? styles.dimmedCard : undefined}>
      <HabitCard
        habit={habit}
        config={config}
        hasTodayNote={hasTodayNote}
        onDictateNote={onDictateNote}
        onEditNote={onEditNote}
        onLongPressReorder={onLongPressReorder}
        delayLongPressReorder={delayLongPressReorder}
        onReorderTouchMove={onReorderTouchMove}
        onReorderTouchEnd={onReorderTouchEnd}
        onReorderTouchCancel={onReorderTouchCancel}
        reorderHint={reorderHint}
      />
    </View>
  );
}
