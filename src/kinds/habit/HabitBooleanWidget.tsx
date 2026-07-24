import React from 'react';
import { View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { HabitConfig } from '../../protocol';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import {
  formatHabitStreakLabel,
  getHabitStreakDays,
} from './habitCardLabels';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import { NoteIconButton } from '../../notes/NoteIconButton';

const ACTION_ICON_SIZE = 30;

export function HabitBooleanWidget({
  element,
  config,
  isDone,
  onToggle,
  onOpenDetails,
  onDictateNote,
  onEditNote,
  hasTodayNote,
  streak,
  onLongPressReorder,
  delayLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  reorderHint,
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const done = Boolean(isDone);
  const streakDays = getHabitStreakDays(config, streak);
  const streakLabel = formatHabitStreakLabel(config, streak);

  return (
    <TrackerCard>
      <View style={styles.oneLineRow}>
        <TrackerCardTitle
          name={element.name}
          icon={config.icon}
          progress={done ? 1 : 0}
          complete={done}
          streakDays={streakDays}
          streakAccessibilityLabel={streakLabel}
          {...trackerCardTitleInteractions({
            onOpenDetails,
            onLongPressReorder,
            onReorderTouchMove,
            onReorderTouchEnd,
            onReorderTouchCancel,
            delayLongPressReorder,
            reorderHint,
          })}
        />

        <View style={styles.trailingCluster}>
          <IconButton
            icon={done ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={ACTION_ICON_SIZE}
            onPress={() => void onToggle?.()}
            iconColor={done ? theme.colors.primary : theme.colors.onSurfaceVariant}
            style={styles.iconButton}
            hitSlop={4}
            accessibilityLabel={
              done ? t('habitWidget.completedTapToUndoA11y') : t('habitWidget.markHabitDoneA11y')
            }
            accessibilityState={{ checked: done }}
            accessibilityRole="checkbox"
          />

          {onDictateNote ? (
            <NoteIconButton
              hasNote={Boolean(hasTodayNote)}
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={ACTION_ICON_SIZE - 4}
              style={styles.iconButton}
            />
          ) : null}
        </View>
      </View>
    </TrackerCard>
  );
}
