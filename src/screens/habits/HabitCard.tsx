import { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import { getKindHandler } from '../../kinds/registry';
import type { RootStackParamList } from '../../navigation/types';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import { useEventStore } from '../../store/eventStore';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  hasTodayNote?: boolean;
  /** Open today's note for this habit; `dictate` starts the mic. Pass a stable callback. */
  onOpenNote?: (habit: ElementDefinition, dictate: boolean) => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
  /** Offer Undo for something this card just did, e.g. clearing today's time. */
  onOfferUndo?: (message: string, undo: () => Promise<void>) => void;
};

/**
 * One habit row on Home. Reads its own slice of the event store and is memoised,
 * so a tick re-renders this card only — give it stable callbacks.
 */
function HabitCard({
  habit,
  config,
  hasTodayNote,
  onOpenNote,
  onLongPressReorder,
  delayLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  reorderHint,
  onOfferUndo,
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const { handleTimerPress, handleFinishTimer, handleResetToday } = useHabitTimerControls();
  const {
    todayTotal,
    isDone,
    streak,
    activeTimerSession,
    toggleHabit,
  } = useEventStore(
    useShallow((state) => ({
      todayTotal: state.dailyTotals[habit.id] ?? 0,
      isDone: state.habitDoneToday[habit.id] ?? false,
      streak: state.habitStreaks[habit.id] ?? 0,
      activeTimerSession: state.activeTimerSessions[habit.id] ?? null,
      toggleHabit: state.toggleHabit,
    })),
  );

  const habitHandler = getKindHandler('habit');
  if (!habitHandler) return null;

  const Widget = habitHandler.DashboardWidget;

  return (
    <Widget
      element={habit}
      config={config}
      todayTotal={todayTotal}
      isDone={isDone}
      streak={streak}
      activeTimerSession={activeTimerSession}
      hasTodayNote={hasTodayNote}
      onDictateNote={onOpenNote ? () => onOpenNote(habit, true) : undefined}
      onEditNote={onOpenNote ? () => onOpenNote(habit, false) : undefined}
      onLongPressReorder={onLongPressReorder}
      delayLongPressReorder={delayLongPressReorder}
      onReorderTouchMove={onReorderTouchMove}
      onReorderTouchEnd={onReorderTouchEnd}
      onReorderTouchCancel={onReorderTouchCancel}
      reorderHint={reorderHint}
      onToggle={() =>
        toggleHabit(habit.id, config).catch((error) => {
          Alert.alert(
            t('habitWidget.couldNotUpdateTitle'),
            error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          );
        })
      }
      onTimerPress={() => handleTimerPress(habit.id, config)}
      onTimerFinish={async () => {
        // Open-ended Done anytime; seconds-target Done after goal (banks overtime).
        // play_once natural end sets trackCompleted elsewhere — false here.
        try {
          await handleFinishTimer(habit.id, config, false);
        } catch (error) {
          Alert.alert(
            t('habitWidget.couldNotFinishTimerTitle'),
            error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          );
          throw error;
        }
      }}
      onResetToday={() =>
        handleResetToday(habit.id, config)
          .then((undo) =>
            onOfferUndo?.(t('undo.timerReset', { name: habit.name }), undo),
          )
          .catch((error) => {
          Alert.alert(
            t('habitWidget.couldNotResetTodayTitle'),
            error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          );
        })
      }
      onOpenDetails={() => navigation.navigate('TrackerHistory', { elementId: habit.id })}
    />
  );
}

export default memo(HabitCard);
