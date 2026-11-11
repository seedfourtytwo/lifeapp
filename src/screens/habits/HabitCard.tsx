import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import { HabitWidget } from '../../kinds/habit/HabitWidget';
import type { RootStackParamList } from '../../navigation/types';
import type { HabitElement } from '../../protocol';
import { useEventStore } from '../../store/eventStore';

type Props = {
  habit: HabitElement;
  hasTodayNote?: boolean;
  onDictateNote?: () => void;
  onEditNote?: () => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
  /** Offer Undo for something this card just did, e.g. clearing today's time. */
  onOfferUndo?: (message: string, undo: () => Promise<void>) => void;
};

export default function HabitCard({
  habit,
  hasTodayNote,
  onDictateNote,
  onEditNote,
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
  const { handleTimerPress, handleMarkDone, handleUnmarkDone, handleResetToday } =
    useHabitTimerControls();
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

  const { config } = habit;

  return (
    <HabitWidget
      element={habit}
      todayTotal={todayTotal}
      isDone={isDone}
      streak={streak}
      activeTimerSession={activeTimerSession}
      hasTodayNote={hasTodayNote}
      onDictateNote={onDictateNote}
      onEditNote={onEditNote}
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
        // Banks a running session; short of the goal it also marks today done.
        try {
          const undoable = await handleMarkDone(habit.id, config);
          if (undoable) {
            onOfferUndo?.(t('undo.markedDone', { name: habit.name }), () =>
              handleUnmarkDone(habit.id, config),
            );
          }
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
