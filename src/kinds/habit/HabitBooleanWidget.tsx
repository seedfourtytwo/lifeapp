import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HabitElement } from '../../protocol';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import { formatHabitStreakLabel } from './habitCardLabels';
import { TrackerCardTick } from '../TrackerCardTick';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import { NoteIconButton } from '../../notes/NoteIconButton';

const NOTE_ICON_SIZE = 24;

export function HabitBooleanWidget({
  element,
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
}: WidgetProps<HabitElement>) {
  const { config } = element;
  const { t } = useTranslation('trackers');
  const done = Boolean(isDone);
  const streakLabel = formatHabitStreakLabel(config, streak);

  return (
    <TrackerCard>
      <View style={styles.oneLineRow}>
        <TrackerCardTitle
          name={element.name}
          icon={config.icon}
          complete={done}
          streakLabel={streakLabel}
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
          <TrackerCardTick
            done={done}
            onPress={() => void onToggle?.()}
            accessibilityLabel={
              done ? t('habitWidget.completedTapToUndoA11y') : t('habitWidget.markHabitDoneA11y')
            }
          />

          {/* Only once there is a note; a first one is added from the history. */}
          {onDictateNote && hasTodayNote ? (
            <NoteIconButton
              hasNote
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={NOTE_ICON_SIZE}
              style={styles.iconButton}
            />
          ) : null}
        </View>
      </View>
    </TrackerCard>
  );
}
