import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HabitConfig } from '../../protocol';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import { habitCardCaption } from './habitCardLabels';
import { skipTodayBubbles } from '../skipTodayBubble';
import { TrackerCardTick } from '../TrackerCardTick';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import { rowKindColour } from '../rowKind';
import { NoteIconButton } from '../../notes/NoteIconButton';

const NOTE_ICON_SIZE = 24;

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
  score,
  skipped,
  onSkipToday,
  onLongPressReorder,
  delayLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  reorderHint,
}: WidgetProps<HabitConfig>) {
  const { t } = useTranslation('trackers');
  const done = Boolean(isDone);
  const [trayOpen, setTrayOpen] = useState(false);
  const caption = habitCardCaption(config, { streak, score, skipped: skipped && !done });
  const bubbles = skipTodayBubbles({ complete: done, skipped: Boolean(skipped), onSkipToday });

  return (
    <TrackerCard>
      <View style={styles.oneLineRow}>
        <TrackerCardTitle
          name={element.name}
          kind={rowKindColour({ kind: 'habit', trackingMode: config.trackingMode })}
          icon={config.icon}
          caption={caption}
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
          <ActionBubbleTray open={trayOpen} onDismiss={() => setTrayOpen(false)} bubbles={bubbles}>
            <TrackerCardTick
              done={done}
              onPress={() => {
                setTrayOpen(false);
                void onToggle?.();
              }}
              onLongPress={bubbles.length > 0 ? () => setTrayOpen((open) => !open) : undefined}
              accessibilityLabel={
                done ? t('habitWidget.completedTapToUndoA11y') : t('habitWidget.markHabitDoneA11y')
              }
              accessibilityHint={bubbles.length > 0 ? t('skip.longPressHint') : undefined}
            />
          </ActionBubbleTray>

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
